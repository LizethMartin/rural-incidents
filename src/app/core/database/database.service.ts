import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import {
    CapacitorSQLite,
    SQLiteConnection,
    SQLiteDBConnection,
} from '@capacitor-community/sqlite';

import {
    DATABASE_NAME,
    DATABASE_SCHEMA,
    DATABASE_VERSION,
} from './database.schema';

/**
 * Valores que utilizaremos como parámetros SQL.
 *
 * Los campos opcionales deben enviarse como null, nunca undefined.
 * Las fechas se envían como números en milisegundos Unix.
 */
export type SqlValue = string | number | null;

/**
 * Administra el acceso a la base de datos local.
 *
 * Responsabilidades:
 * - Crear o recuperar la conexión.
 * - Abrir la base de datos.
 * - Crear el esquema inicial.
 * - Ejecutar lecturas y escrituras parametrizadas.
 *
 * La validación de incidentes y la sincronización con Firebase
 * corresponden a otros servicios.
 */
@Injectable({
    providedIn: 'root',
})
export class DatabaseService {
    //Administrador de conexiones del plugin.
    private readonly sqlite = new SQLiteConnection(CapacitorSQLite);

    //Promesa compartida de inicialización.
    private initialization: Promise<SQLiteDBConnection> | null = null;

    //Permite inicializar SQLite explícitamente.
    async initialize(): Promise<void> {
        await this.getDatabase();
    }

    /**
     * Ejecuta una lectura y devuelve sus filas.
     *
     * @param statement Consulta SELECT con marcadores ?.
     * @param values Valores en el mismo orden que los marcadores.
     * 
     */
    async query<T>(
        statement: string,
        values: SqlValue[] = [],
    ): Promise<T[]> {
        const database = await this.getDatabase();
        const result = await database.query(statement, values);

        // Si no hay resultados, devolvemos un arreglo vacío.
        return (result.values ?? []) as T[];
    }

    /**
     * Ejecuta una escritura: INSERT, UPDATE o DELETE.
     *
     * @returns Cantidad de filas afectadas.
     *
     */
    async run(
        statement: string,
        values: SqlValue[] = [],
    ): Promise<number> {
        // Espera a que la base esté abierta y la tabla creada.
        const database = await this.getDatabase();

        // Ejecuta la instrucción con sus parámetros.
        // true indica que esta escritura se ejecuta en una transacción.
        const result = await database.run(statement, values, true);
        // Extrae la cantidad de filas afectadas de la respuesta del plugin.
        const changes = result.changes?.changes;

        // No ocultamos una respuesta inesperada como si fuera exitosa.
        if (changes === undefined || changes < 0) {
        throw new Error('SQLite no pudo confirmar la escritura.');
        }

        // Puede ser 0 si ningún registro coincidió con el WHERE.
        return changes;
    }

    // Obtiene conexión inicializada.
    private getDatabase(): Promise<SQLiteDBConnection> {
        if (!this.initialization) {
        this.initialization = this.openDatabase().catch(
            (error: unknown) => {
            this.initialization = null;
            throw error;
            },
        );
        }

        return this.initialization;
    }

    // Abre SQLite y prepara el esquema inicial.
    private async openDatabase(): Promise<SQLiteDBConnection> {
        if (!Capacitor.isNativePlatform()) {
            throw new Error(
                'Esta configuración de SQLite requiere Android o iOS. ' +
                'El navegador necesita una configuración adicional.',
            );
        }

        // Verifica que las conexiones de JavaScript y del plugin nativo sean consistentes.
        await this.sqlite.checkConnectionsConsistency();

        const existing = await this.sqlite.isConnection(
            DATABASE_NAME,
            false,
        );

        // Reutiliza la conexión existente o crea una nueva.
        const database = existing.result
            ? await this.sqlite.retrieveConnection(DATABASE_NAME, false)
            : await this.sqlite.createConnection(
                DATABASE_NAME,
                false, // Base de datos sin cifrado.
                'no-encryption',
                DATABASE_VERSION,
                false, // Permite lectura y escritura.
                );

        const openState = await database.isDBOpen();

        if (!openState.result) {
            await database.open();
        }

        //Crea la tabla y sus índices dentro de una transacción.
        await database.execute(DATABASE_SCHEMA, true);

        return database;
    }
}