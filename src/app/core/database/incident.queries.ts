//Consultas de persistencia local.
export const INCIDENT_QUERIES = {
    /**
     * Creación - Reporte pendiente de sincronización.
     *
     * Parámetros:
     * [id, userId, title, description, photoLocalPath,
     *  latitude, longitude, temperatureC, createdAt, updatedAt]
     *
     * temperatureC debe ser un número o null.
     */
    create: `
        INSERT INTO incidents (
            id,
            user_id,
            title,
            description,
            photo_local_path,
            latitude,
            longitude,
            temperature_c,
            created_at,
            updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,

    /**
     * Lista los reportes activos del usuario, del más reciente al más antiguo.
     *
     * Parámetros: [userId]
     */
    listByUser: `
        SELECT *
        FROM incidents
        WHERE user_id = ?
        AND deleted_at IS NULL
        ORDER BY created_at DESC, id ASC;
    `,

    /**
     * Obtiene un reporte activo para la pantalla de detalle.
     *
     * Parámetros: [id, userId]
     */
    findById: `
        SELECT *
        FROM incidents
        WHERE id = ?
        AND user_id = ?
        AND deleted_at IS NULL;
    `,

    /**
     * Guarda una edición y vuelve a marcar el reporte como pendiente.
     *
     * Si la foto cambia, photoRemoteUrl debe ser null hasta subir
     * la nueva foto. Si no cambia, se conserva su URL actual.
     *
     * Parámetros:
     * [title, description, photoLocalPath, photoRemoteUrl,
     *  latitude, longitude, temperatureC, updatedAt, id, userId, localRevision]
     */
    update: `
        UPDATE incidents
        SET title = ?,
            description = ?,
            photo_local_path = ?,
            photo_remote_url = ?,
            latitude = ?,
            longitude = ?,
            temperature_c = ?,
            updated_at = ?,
            local_revision = local_revision + 1,
            sync_status = 'pending'
        WHERE id = ?
        AND user_id = ?
        AND deleted_at IS NULL
        AND local_revision = ?;
    `,

    /**
     * Oculta el reporte y deja pendiente su eliminación remota.
     *
     * Parámetros: [deletedAt, updatedAt, id, userId,localRevision]
     * Utilizar el mismo instante para deletedAt y updatedAt.
     */
    softDelete: `
        UPDATE incidents
        SET deleted_at = ?,
            updated_at = ?,
            local_revision = local_revision + 1,
            sync_status = 'pending'
        WHERE id = ?
        AND user_id = ?
        AND deleted_at IS NULL
        AND local_revision = ?;
    `,

    /**
     * Obtiene reportes nuevos, modificados o con un envío fallido.
     * Incluye eliminaciones pendientes de comunicar a Firebase.
     *
     * Ejecutar una vez por ciclo de sincronización.
     * No repetir inmediatamente en bucle si hay errores.
     *
     * Parámetros: [userId]
     */
    listPending: `
        SELECT *
        FROM incidents
        WHERE user_id = ?
            AND sync_status IN ('pending', 'error')
        ORDER BY updated_at ASC, id ASC;
    `,

    /**
     * Inicia un envío o reintento de una revisión concreta.
     * Continuar con Firebase solo si se modificó una fila.
     *
     * Parámetros: [id, userId, localRevision]
     */
    markSyncing: `
        UPDATE incidents
        SET sync_status = 'syncing'
        WHERE id = ?
            AND user_id = ?
            AND local_revision = ?
            AND sync_status IN ('pending', 'error');
    `,

    /**
     * Confirma que la revisión enviada se sincronizó correctamente.
     * No confirma cambios que el usuario haya realizado durante el envío.
     *
     * Parámetros: [photoRemoteUrl, id, userId, localRevision]
     */
    markSynced: `
        UPDATE incidents
        SET sync_status = 'synced',
            photo_remote_url = ?
        WHERE id = ?
            AND user_id = ?
            AND local_revision = ?
            AND sync_status = 'syncing';
    `,

    /**
     * Registra el fallo de la revisión que se estaba enviando.
     * Sustituye la consulta markPending anterior.
     *
     * Si el usuario editó mientras se enviaba, la nueva revisión
     * permanece pending y no queda marcada con un error anterior.
     *
     * Parámetros: [id, userId, localRevision]
     */
    markError: `
        UPDATE incidents
        SET sync_status = 'error'
        WHERE id = ?
            AND user_id = ?
            AND local_revision = ?
            AND sync_status = 'syncing';
    `,

    /**
     * Marca como error los envíos interrumpidos al cerrar la app.
     *
     * Parámetros: [userId]
     */
    recoverInterruptedSync: `
        UPDATE incidents
        SET sync_status = 'error'
        WHERE user_id = ?
            AND sync_status = 'syncing';
        `,
} as const;