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
| `TYPEORM_SYNCHRONIZE`     | Synchronize the database, make backups before doing this in production |               |
| `PORT`                    | Port the server binds to                                               | 3000          |
| `DISCORD_CLIENT_ID`       | OAuth client ID for Discord SSO                                        |               |
| `DISCORD_CLIENT_SECRET`   | OAuth client secret for Discord SSO                                    |               |
| `DISCORD_CALLBACK_URL`    | OAuth callback url for Discord SSO                                     |               |
| `JWT_SECRET`              | JWT secret for signing access tokens                                   |               |
| `WEBSITE_AUTH_CALLBACK`   | Callback URL for SSO with returnTo=website                             |               |
| `LOCALHOST_AUTH_CALLBACK` | Callback URL for SSO with returnTo=localhost                           |               |

## Copyright and License

The ChunkyCloud API Server is [MIT licensed](./LICENSE).
