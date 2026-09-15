import { Injectable, inject } from '@angular/core';

import { IncidentRow } from '../../models/incident.model';
import { DatabaseService } from './database.service';
import { INCIDENT_QUERIES } from './incident.queries';

//Consultas locales de incidentes.
@Injectable({
    providedIn: 'root',
})
export class IncidentLocalService {
    private readonly database = inject(DatabaseService);

    //Devuelve los incidentes activos del usuario.
    async listByUser(userId: string): Promise<IncidentRow[]> {
        return this.database.query<IncidentRow>(INCIDENT_QUERIES.listByUser, [
            userId,
        ]);
    }

    //Busca un incidente activo perteneciente al usuario.
    async findById(id: string, userId: string): Promise<IncidentRow | null> {
        const rows = await this.database.query<IncidentRow>(
            INCIDENT_QUERIES.findById,
            [id, userId],
        );

        return rows[0] ?? null;
    }

    //Obtiene los cambios pendientes y los envíos fallidos (Incluye reportes eliminados).
    async listPending(userId: string): Promise<IncidentRow[]> {
        return this.database.query<IncidentRow>(INCIDENT_QUERIES.listPending, [
            userId,
        ]);
    }

    //Reclama una revisión para sincronizarla.
    async markSyncing(
        id: string,
        userId: string,
        localRevision: number,
    ): Promise<boolean> {
        const changes = await this.database.run(INCIDENT_QUERIES.markSyncing, [
            id,
            userId,
            localRevision,
        ]);

        return changes === 1;
    }
}
