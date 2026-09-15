/**
 * Estados de sincronización de un incidente con el servidor
 * pending: hay cambios locales pendientes de enviar.
 * syncing: el reporte se está enviando.
 * synced: la versión local ya fue sincronizada.
 * error: hubo un error en la sincronización, permite mostrar el error y reintentar..
 */
export type IncidentSyncStatus = 'pending' | 'syncing' | 'synced' | 'error';

/**
 * Incidente utilizado por los componentes y servicios de la aplicación.
 *
 * Todas las fechas se representan como milisegundos Unix
 * para mantener el mismo formato y facilitar comparaciones.
 */
export interface Incident {
    id: string; //ID del documento en Firestore.
    userId: string; //ID del usuario que creó el incidente (Firebase Auth).
    title: string; // Título del incidente (Obligatorio).
    description: string | null;// Descripción opcional del incidente.
    photoLocalPath: string | null; // Ruta persistente del archivo en el dispositivo. No debe contener el binario ni una imagen en base64.
    photoRemoteUrl: string | null; //URL de la fotografía (Firebase Storage).
    //Coordenadas capturadas al crear el incidente.
    latitude: number;
    longitude: number;
    temperatureC: number | null; // Temperatura en grados Celsius, o null si no está disponible.
    syncStatus: IncidentSyncStatus;// Estado de sincronización (Firebase) del incidente con el servidor.
    createdAt: number; //Fecha de creación del incidente.
    updatedAt: number; //Fecha de la última actualización del incidente.
    deletedAt: number | null; //Fecha de eliminación lógica del incidente o null si sigue activo.
    localRevision: number; //Contador local que aumenta al editar o eliminar. Evita marcar como sincronizados cambios que todavía no se enviaron.
}

//Datos que recibe el servicio para crear un incidente.
export interface CreateIncidentInput {
    title: string;
    description?: string | null;
    photoLocalPath: string;
    latitude: number;
    longitude: number;
    temperatureC?: number | null;
}

//Datos editables del incidente.
export interface UpdateIncidentInput {
    title: string;
    description: string | null;
    photoLocalPath: string | null;
    photoRemoteUrl: string | null;
    latitude: number;
    longitude: number;
    temperatureC: number | null;
}

//Representación fila en SQLite.
export interface IncidentRow {
    id: string;
    user_id: string;
    title: string;
    description: string | null;
    photo_local_path: string | null;
    photo_remote_url: string | null;
    latitude: number;
    longitude: number;
    temperature_c: number | null;
    sync_status: IncidentSyncStatus;
    created_at: number;
    updated_at: number;
    deleted_at: number | null;
    local_revision: number;
}

//Datos Firestore.
export type RemoteIncident = Omit<
    Incident,
    'photoLocalPath' | 'syncStatus' | 'localRevision'
>;
