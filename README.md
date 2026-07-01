# pi-config

Personal Pi package for extensions and skills.

## Install

```bash
pi install git:git@github.com:jp-belanger/pi-config.git
```

For local development from this checkout:

```bash
cd ~/src/pi-config
pi install "$(pwd)"
```

## Reload changes

After changing extensions or skills, reload Pi:

```text
/reload
```

## Update

```bash
pi update --extensions
```

## Remove

```bash
pi remove git:git@github.com:jp-belanger/pi-config.git
```
