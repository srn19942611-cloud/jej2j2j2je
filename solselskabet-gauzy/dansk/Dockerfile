# Dansk udgave af Gauzys webapp: samme image som originalen, men med dansk sprogfil,
# danske plugin-ordbøger, danske hårdkodede tekster og danske datoformater.
ARG GAUZY_WEBAPP=ghcr.io/ever-co/gauzy-webapp@sha256:9757fbe2a198e8289ef00a384179bf0239aa5ca002a2db1feda850ae733d02e0

FROM ${GAUZY_WEBAPP} AS original

FROM mirror.gcr.io/library/node:22-alpine AS dansk
COPY --from=original /srv/gauzy /srv/gauzy
COPY da.json plugins-da.json ui-tekster.json patch.cjs /dansk/
RUN node /dansk/patch.cjs /srv/gauzy /dansk

FROM ${GAUZY_WEBAPP}
COPY --from=dansk --chown=nginx:nginx /srv/gauzy /srv/gauzy
