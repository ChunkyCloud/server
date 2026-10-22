# ChunkyCloud API Server

This is the API server for ChunkyCloud, a distributed rendering service for [Chunky][chunky]. It handles users (including Discord SSO), nodes, render jobs and scheduling.

[chunky]: https://github.com/chunky-dev/chunky

## Configuration

The server is configured using environment variables.

| Environment variable      | Description                                                            | Default value |
| ------------------------- | ---------------------------------------------------------------------- | ------------- |
| `MARIADB_HOST`            | Database host (MariaDB 11.8)                                           | localhost     |
| `MARIADB_PORT`            | Database port                                                          | 3306          |
| `MARIADB_USER`            | Database user                                                          |               |
| `MARIADB_PASSWORD`        | Database password                                                      |               |
| `MARIADB_DATABASE`        | Database name                                                          | chunkycloud   |
| `MARIADB_POOL_SIZE`       | Database connection pool size                                          | 10            |
| `TYPEORM_SYNCHRONIZE`     | Synchronize the database, make backups before doing this in production |               |
| `PORT`                    | Port the server binds to                                               | 3000          |
| `DISCORD_CLIENT_ID`       | OAuth client ID for Discord SSO                                        |               |
| `DISCORD_CLIENT_SECRET`   | OAuth client secret for Discord SSO                                    |               |
| `DISCORD_CALLBACK_URL`    | OAuth callback url for Discord SSO                                     |               |
| `JWT_SECRET`              | JWT secret for signing access tokens                                   |               |
| `WEBSITE_AUTH_CALLBACK`   | Callback URL for SSO with returnTo=website                             |               |
| `LOCALHOST_AUTH_CALLBACK` | Callback URL for SSO with returnTo=localhost                           |               |
| `AUTH_PROVIDER`           | Auth provider (discord or fake)                                        | discord       |

### Storage

Currently, the storage only supports S3-compatible storage. You can use a cloud provider (e.g. Cloudflare R2 or AWS) or run a self-hosted solution like [garage](https://git.deuxfleurs.fr/Deuxfleurs/garage). Saving the files in a local directory is planned but not yet supported.

| Environment variable | Description            | Default value | Example (Cloudflare R2)                                                                           |
| -------------------- | ---------------------- | ------------- | ------------------------------------------------------------------------------------------------- |
| `S3_URL`             | S3-compatible endpoint |               | https://[random string].eu.r2.cloudflarestorage.com                                               |
| `S3_REGION`          | Region                 | us-east-1     |
| `S3_ACCESS_KEY`      | Access key             |               | Access key obtained by creating an _Account API token_ with R2 Storage read and write permissions |
| `S3_SECRET_KEY`      | Secret key             |               | Secret key of that _Account API token_                                                            |
| `S3_STORAGE_CLASS`   | Storage class          |               |
| `S3_BUCKET`          | Bucket name            |               | chunkycloud                                                                                       |

## Admin CLI

An administrative CLI is provided for common management tasks, such as creating worker nodes and managing jobs.

Run `npm run start:cli` to start the CLI locally.

When running inside the Docker container, the CLI is available as the `ccloud` command.

## Copyright and License

The ChunkyCloud API Server is [MIT licensed](./LICENSE).
