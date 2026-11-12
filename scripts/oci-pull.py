#!/usr/bin/env python3
"""Pull a Docker Hub image with plain HTTPS (requests) and emit a tarball
that `docker load` accepts.

Why this exists: on this VM the Docker daemon's Go HTTP client gets its
connections to registry-1.docker.io / auth.docker.io terminated mid-flight
("unexpected EOF"), while the same requests via curl/requests succeed
repeatedly. The egress proxy appears to interfere with the daemon's
connection reuse. So we fetch manifests + blobs over requests (with retries
and resume) and assemble the docker-save format ourselves.

Usage:
  python3 scripts/oci-pull.py supabase/postgres:15.8.1.060
  python3 scripts/oci-pull.py supabase/postgres:15.8.1.060 --load   # also docker load
Output: /tmp/oci/<repo>_<tag>.tar
"""
import hashlib
import json
import os
import sys
import tarfile
import time

import requests

REGISTRY = "https://registry-1.docker.io"
AUTH_URL = "https://auth.docker.io/token"
# /tmp is a 512M tmpfs on this VM — Postgres layers do not fit. Keep the
# cache on the (large) home disk; override with OCI_CACHE_DIR.
CACHE = os.environ.get(
    "OCI_CACHE_DIR", os.path.expanduser("~/workspace/.oci-cache")
)
MANIFEST_TYPES = [
    "application/vnd.docker.distribution.manifest.list.v2+json",
    "application/vnd.oci.image.index.v1+json",
    "application/vnd.docker.distribution.manifest.v2+json",
    "application/vnd.oci.image.manifest.v1+json",
]


def session():
    s = requests.Session()
    # requests honours HTTP(S)_PROXY env vars automatically.
    adapter = requests.adapters.HTTPAdapter(max_retries=0)
    s.mount("https://", adapter)
    return s


def get_with_retries(s, url, headers=None, stream=False, tries=8):
    last = None
    for attempt in range(1, tries + 1):
        try:
            r = s.get(url, headers=headers or {}, stream=stream, timeout=120)
            if r.status_code in (200, 206):
                return r
            last = Exception(f"HTTP {r.status_code} for {url}")
        except Exception as e:  # noqa: BLE001 - retry transient network errors
            last = e
        wait = min(2**attempt, 30)
        print(f"  retry {attempt}/{tries} for {url} after {wait}s ({last})", flush=True)
        time.sleep(wait)
    raise last  # type: ignore[misc]


def token_for(s, repo):
    r = get_with_retries(
        s, f"{AUTH_URL}?service=registry.docker.io&scope=repository:{repo}:pull"
    )
    return r.json()["token"]


def fetch_json(s, url, token, accept):
    r = get_with_retries(
        s, url, headers={"Authorization": f"Bearer {token}", "Accept": accept}
    )
    return r.json(), r.headers.get("Docker-Content-Digest", "")


def download_blob(s, repo, digest, token, dest):
    size = None
    if os.path.exists(dest):
        # verify existing file
        h = hashlib.sha256()
        with open(dest, "rb") as f:
            for chunk in iter(lambda: f.read(1 << 20), b""):
                h.update(chunk)
        if f"sha256:{h.hexdigest()}" == digest:
            print(f"  cached {digest[:19]} ({os.path.getsize(dest)} bytes)")
            return os.path.getsize(dest)
        print(f"  cached {dest} failed checksum, re-downloading")
        os.remove(dest)
    url = f"{REGISTRY}/v2/{repo}/blobs/{digest}"
    headers = {"Authorization": f"Bearer {token}"}
    # Resume support
    downloaded = 0
    mode = "wb"
    if os.path.exists(dest + ".partial"):
        downloaded = os.path.getsize(dest + ".partial")
        headers["Range"] = f"bytes={downloaded}-"
        mode = "ab"
    for attempt in range(1, 9):
        try:
            r = s.get(url, headers=headers, stream=True, timeout=180)
            if r.status_code == 206:
                pass
            elif r.status_code == 200 and downloaded:
                downloaded = 0
                mode = "wb"
            elif r.status_code != 200:
                raise Exception(f"HTTP {r.status_code}")
            total = int(r.headers.get("Content-Length", "0") or 0) + downloaded
            with open(dest + ".partial", mode) as f:
                for chunk in r.iter_content(1 << 20):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
            os.rename(dest + ".partial", dest)
            # verify
            h = hashlib.sha256()
            with open(dest, "rb") as f:
                for chunk in iter(lambda: f.read(1 << 20), b""):
                    h.update(chunk)
            if f"sha256:{h.hexdigest()}" != digest:
                raise Exception("checksum mismatch after download")
            print(f"  blob {digest[:19]} ({downloaded} bytes)")
            return downloaded
        except Exception as e:  # noqa: BLE001
            print(f"  blob {digest[:19]} attempt {attempt} failed: {e}", flush=True)
            downloaded = os.path.getsize(dest + ".partial") if os.path.exists(dest + ".partial") else 0
            if downloaded:
                headers["Range"] = f"bytes={downloaded}-"
                mode = "ab"
            time.sleep(min(2**attempt, 30))
    raise Exception(f"failed to download {digest}")


def main():
    image = sys.argv[1]
    do_load = "--load" in sys.argv
    if ":" in image:
        repo, tag = image.rsplit(":", 1)
    else:
        repo, tag = image, "latest"
    workdir = os.path.join(CACHE, repo.replace("/", "_") + "_" + tag)
    os.makedirs(workdir, exist_ok=True)
    s = session()
    # Docker Hub official images (single-segment names like `kong`) live
    # under the `library/` namespace in the registry API. Without it the
    # manifest fetch 401s. RepoTags keep the short name the CLI expects.
    registry_repo = repo if "/" in repo else f"library/{repo}"
    token = token_for(s, registry_repo)

    # Resolve tag -> manifest (index or single manifest)
    idx, _ = fetch_json(
        s, f"{REGISTRY}/v2/{registry_repo}/manifests/{tag}", token, ", ".join(MANIFEST_TYPES)
    )
    if idx.get("mediaType", "").endswith("index.v1+json") or "manifests" in idx:
        manifest = next(
            m
            for m in idx["manifests"]
            if m["platform"]["architecture"] == "amd64" and m["platform"]["os"] == "linux"
        )
        digest = manifest["digest"]
        man, _ = fetch_json(
            s,
            f"{REGISTRY}/v2/{registry_repo}/manifests/{digest}",
            token,
            "application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json",
        )
    else:
        man = idx

    config_digest = man["config"]["digest"]
    layers = [l["digest"] for l in man["layers"]]

    blobdir = os.path.join(workdir, "blobs")
    os.makedirs(blobdir, exist_ok=True)
    config_path = os.path.join(blobdir, config_digest.replace(":", "_") + ".json")
    download_blob(s, registry_repo, config_digest, token, config_path)
    layer_paths = []
    for d in layers:
        p = os.path.join(blobdir, d.replace(":", "_") + ".tar")
        download_blob(s, registry_repo, d, token, p)
        layer_paths.append(p)

    # Assemble docker-save tarball. Use the registry config blob as-is: it
    # already carries rootfs.diff_ids (UNCOMPRESSED digests). Layer entries
    # must be named <diff_id>/layer.tar using those diff_ids, NOT the
    # compressed blob digests from the manifest.
    config = json.load(open(config_path))
    diff_ids = config["rootfs"]["diff_ids"]
    assert len(diff_ids) == len(layer_paths), "config diff_ids != manifest layers"
    tar_path = os.path.join(CACHE, f"{repo.replace('/', '_')}_{tag}.tar")
    with tarfile.open(tar_path, "w") as tf:
        # config blob stored under its content hash name
        cfg_name = config_digest.replace("sha256:", "") + ".json"
        tf.add(config_path, arcname=cfg_name)
        layer_names = []
        for diff_id, p in zip(diff_ids, layer_paths):
            diff_hex = diff_id.replace("sha256:", "")
            layer_names.append(f"{diff_hex}/layer.tar")
            ti = tf.gettarinfo(p, arcname=f"{diff_hex}/layer.tar")
            ti.size = os.path.getsize(p)
            with open(p, "rb") as f:
                tf.addfile(ti, f)
        manifest_json = [
            {
                "Config": cfg_name,
                "RepoTags": [f"{repo}:{tag}"],
                "Layers": layer_names,
            }
        ]
        data = json.dumps(manifest_json).encode()
        import io

        ti = tarfile.TarInfo("manifest.json")
        ti.size = len(data)
        tf.addfile(ti, io.BytesIO(data))
        repos_data = json.dumps({repo: {tag: config_digest.replace("sha256:", "")}}).encode()
        ti = tarfile.TarInfo("repositories")
        ti.size = len(repos_data)
        tf.addfile(ti, io.BytesIO(repos_data))
    print(f"wrote {tar_path} ({os.path.getsize(tar_path)} bytes)")
    if do_load:
        os.system(f"docker load -i {tar_path}")


if __name__ == "__main__":
    main()
