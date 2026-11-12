FROM node:20-slim

# ClamAV daemon + freshclam for signature updates.
RUN apt-get update \
  && apt-get install -y --no-install-recommends clamav clamav-daemon \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /var/lib/clamav /var/log/clamav /run/clamav \
  && chown -R clamav:clamav /var/lib/clamav /var/log/clamav /run/clamav

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY index.mjs ./

# freshclam at boot (needs network), then clamd in the background, then the worker.
CMD freshclam && (clamd & ) && sleep 5 && node index.mjs
