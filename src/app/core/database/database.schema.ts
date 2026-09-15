// Nombre de la base de datos local de la aplicación.
export const DATABASE_NAME = 'rural_incidents';
// Versión inicial del esquema.
export const DATABASE_VERSION = 1;
//Esquema inicial de la base de datos local. Se utiliza para crear la base de datos y actualizarla en caso de cambios.
export const DATABASE_SCHEMA = `
    CREATE TABLE IF NOT EXISTS incidents (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,

        title TEXT NOT NULL
        CHECK (
            length(trim(title)) > 0
            AND length(title) <= 100
        ),

        description TEXT,

        -- Almacenamiento de referencias de la foto (nunca el archivo binario).
        photo_local_path TEXT,
        photo_remote_url TEXT,

        latitude REAL NOT NULL
        CHECK (latitude BETWEEN -90 AND 90),

        longitude REAL NOT NULL
        CHECK (longitude BETWEEN -180 AND 180),

        -- Temperatura opcional del momento de creación del reporte.
        temperature_c REAL,

        -- Incluye un estado visible para los intentos fallidos.
        sync_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (sync_status IN ('pending', 'syncing', 'synced', 'error')),

        created_at INTEGER NOT NULL
        CHECK (created_at >= 0),

        updated_at INTEGER NOT NULL
        CHECK (updated_at >= created_at),

        -- Una fecha indica que el reporte fue eliminado lógicamente.
        deleted_at INTEGER
        CHECK (deleted_at IS NULL OR deleted_at >= created_at),

        local_revision INTEGER NOT NULL DEFAULT 1
        CHECK (local_revision >= 1)
    );

    -- Acelera el listado de reportes activos del usuario.
    CREATE INDEX IF NOT EXISTS idx_incidents_user_list
        ON incidents (user_id, deleted_at, created_at DESC);

    -- Acelera la búsqueda de cambios pendientes del usuario.
    CREATE INDEX IF NOT EXISTS idx_incidents_user_sync
        ON incidents (user_id, sync_status, updated_at);
    `;
