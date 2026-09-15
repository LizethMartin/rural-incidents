import { Injectable, inject } from '@angular/core';

import { CreateIncidentInput, Incident, IncidentRow, UpdateIncidentInput } from '../../models/incident.model';
import { DatabaseService } from './database.service';
import { INCIDENT_QUERIES } from './incident.queries';

//Consultas locales de incidentes.
@Injectable({
    providedIn: 'root',
})
export class IncidentLocalService {
    private readonly database = inject(DatabaseService);

    //Crea un incidente sin necesitar conexión a internet.
    async create(
        userId: string,
        input: CreateIncidentInput,
    ): Promise<Incident> {
        this.validateUserId(userId);

        const title = input.title.trim();
        const temperatureC = input.temperatureC ?? null;

        this.validateContent(
            title,
            input.latitude,
            input.longitude,
            temperatureC,
        );

        if (!input.photoLocalPath?.trim()) {
            throw new Error('Debes agregar una fotografía al reporte.');
        }

        // Genera el ID en el dispositivo; se reutilizará en Firestore.
        const id = crypto.randomUUID();
        const now = Date.now();

        const changes = await this.database.run(
            INCIDENT_QUERIES.create,
            [
                id,
                userId,
                title,
                this.normalizeDescription(input.description),
                input.photoLocalPath,
                input.latitude,
                input.longitude,
                temperatureC,
                now,
                now,
            ],
        );

        if (changes !== 1) {
        throw new Error('No se pudo guardar el incidente.');
        }

        // Lee la fila para incluir los valores por defecto del esquema:
        // sync_status = pending y local_revision = 1.
        return this.requireIncident(id, userId);
    }


    //Devuelve los incidentes activos del usuario como modelos Incident.
    async listByUser(userId: string): Promise<Incident[]> {
        this.validateUserId(userId);

        const rows = await this.database.query<IncidentRow>(
            INCIDENT_QUERIES.listByUser,
            [userId],
        );

        return rows.map((row) => this.toIncident(row));
    }

    //Busca un incidente activo perteneciente al usuario.
    async findById(id: string, userId: string): Promise<Incident | null> {
        this.validateUserId(userId)
        const rows = await this.database.query<IncidentRow>(
            INCIDENT_QUERIES.findById,
            [id, userId],
        );

        return rows[0] ? this.toIncident(rows[0]) : null;
    }

    //Guarda una edición completa.
    async update(
        id: string,
        userId: string,
        input: UpdateIncidentInput,
        expectedRevision: number,
    ): Promise<Incident> {
        const current = await this.requireIncident(id, userId);

        //ExpectedRevision es la localRevision que tenía el reporte
        //cuando se cargó en el formulario. Si cambió desde entonces,
        this.validateRevision(current, expectedRevision); 

        const title = input.title.trim();

        this.validateContent(
            title,
            input.latitude,
            input.longitude,
            input.temperatureC,
        );

        //Las fotos nuevas deben guardarse con una ruta distinta.
        const photoChanged = input.photoLocalPath !== current.photoLocalPath;

        if (photoChanged && !input.photoLocalPath?.trim()) {
            throw new Error('Debes proporcionar la nueva fotografía.');
        }

        // No tomamos input.photoRemoteUrl del formulario:
        // la URL definitiva la establecerá la sincronización.
        const photoRemoteUrl = photoChanged
            ? null
            : current.photoRemoteUrl;

        // Garantiza una fecha mayor a la edición anterior en este dispositivo.
        const updatedAt = Math.max(Date.now(), current.updatedAt + 1);

        const changes = await this.database.run(
            INCIDENT_QUERIES.update,
            [
                title,
                this.normalizeDescription(input.description),
                input.photoLocalPath,
                photoRemoteUrl,
                input.latitude,
                input.longitude,
                input.temperatureC,
                updatedAt,
                id,
                userId,
                expectedRevision,
            ],
        );

        //El WHERE comprueba otra vez la revisión, porque el reporte (en caso de cambio de la lectura inicial).
        if (changes !== 1) {
            throw new Error(
                'El incidente cambió o fue eliminado. Recárgalo antes de editar.',
            );
        }

        return this.requireIncident(id, userId);
    }

    // Elimina lógicamente un incidente.
    async softDelete(
        id: string,
        userId: string,
        expectedRevision: number,
    ): Promise<void> {
        const current = await this.requireIncident(id, userId);

        this.validateRevision(current, expectedRevision);

        const deletedAt = Math.max(Date.now(), current.updatedAt + 1);

        const changes = await this.database.run(
            INCIDENT_QUERIES.softDelete,
            [
                deletedAt,
                deletedAt,
                id,
                userId,
                expectedRevision,
            ],
        );

        if (changes !== 1) {
        throw new Error(
            'El incidente cambió o fue eliminado. Actualiza el listado.',
        );
        }
    }

    //Obtiene los cambios pendientes y los envíos fallidos (Incluye reportes eliminados).
    async listPending(userId: string): Promise<Incident[]> {
        this.validateUserId(userId);

        const rows =await this.database.query<IncidentRow>(INCIDENT_QUERIES.listPending, [userId]);

        return rows.map((row) => this.toIncident(row));
    }

    //Reclama una revisión para sincronizarla.
    async markSyncing(
        id: string,
        userId: string,
        localRevision: number,
    ): Promise<boolean> {
        this.validateUserId(userId);

        const changes = await this.database.run(INCIDENT_QUERIES.markSyncing, 
            [id, userId, localRevision]);

        return changes === 1;
    }

    //Obtiene un incidente o lanza un error.
    private async requireIncident(
        id: string,
        userId: string,
    ): Promise<Incident> {
        const incident = await this.findById(id, userId);

        if (!incident) {
            throw new Error('No se encontró el incidente para este usuario.');
        }

        return incident;
    }

    //Evita operaciones sin un identificador de usuario.
    private validateUserId(userId: string): void {
        if (!userId?.trim()) {
            throw new Error('Se requiere un usuario autenticado.');
        }
    }

    // Detecta una edición basada en una versión antigua del reporte.
    private validateRevision(
        current: Incident,
        expectedRevision: number,
    ): void {
        if (current.localRevision !== expectedRevision) {
            throw new Error(
                'El incidente tiene cambios recientes. Recárgalo para continuar.',
            );
        }
    }

    // Valida las reglas principales antes de ejecutar SQL.
    private validateContent(
        title: string,
        latitude: number,
        longitude: number,
        temperatureC: number | null,
    ): void {
        if (!title || title.length > 100) {
            throw new Error('El título debe tener entre 1 y 100 caracteres.');
        }

        if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
            throw new Error('La latitud no es válida.');
        }

        if (
            !Number.isFinite(longitude) ||
            longitude < -180 ||
            longitude > 180
        ) {
            throw new Error('La longitud no es válida.');
        }

        if (temperatureC !== null && !Number.isFinite(temperatureC)) {
            throw new Error('La temperatura debe ser un número o null.');
        }
    }

    // Almacena las descripciones vacías como null.
    private normalizeDescription(
        description: string | null | undefined,
    ): string | null {
        return description?.trim() || null;
    }

    // Convierte los nombres de columnas SQLite a las propiedades
    // utilizadas por componentes y formularios.
    private toIncident(row: IncidentRow): Incident {
        return {
            id: row.id,
            userId: row.user_id,
            title: row.title,
            description: row.description,
            photoLocalPath: row.photo_local_path,
            photoRemoteUrl: row.photo_remote_url,
            latitude: row.latitude,
            longitude: row.longitude,
            temperatureC: row.temperature_c,
            syncStatus: row.sync_status,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            deletedAt: row.deleted_at,
            localRevision: row.local_revision,
        };
    }
}
