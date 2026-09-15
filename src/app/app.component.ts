import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DatabaseService } from './core/database/database.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit  {
  title = 'rural-incidents';

  private readonly database = inject(DatabaseService);

  /**
   * Prueba temporal del plugin nativo.
   *
   * Utiliza una tabla independiente para verificar:
   * apertura, escritura, lectura y persistencia al reiniciar.
   */
  async ngOnInit(): Promise<void> {
    try {
      await this.database.initialize();

      // Crea una tabla de diagnóstico sin tocar los incidentes.
      await this.database.run(`
        CREATE TABLE IF NOT EXISTS app_database_test (
          id INTEGER PRIMARY KEY,
          launches INTEGER NOT NULL
        );
      `);


      // Inserta el contador únicamente la primera vez.
      await this.database.run(`
        INSERT OR IGNORE INTO app_database_test (id, launches)
        VALUES (1, 0);
      `);

      // Cada arranque incrementa el contador persistido.
      await this.database.run(`
        UPDATE app_database_test
        SET launches = launches + 1
        WHERE id = 1;
      `);

      const rows = await this.database.query<{ launches: number }>(
        'SELECT launches FROM app_database_test WHERE id = ?;',
        [1],
      );

      if (!rows[0]) {
        throw new Error('No se pudo leer el registro de prueba.');
      }

      // Se muestra en pantalla usando la interpolación {{ title }}
      // que puedes agregar temporalmente al HTML.
      this.title = `SQLite funciona. Arranques: ${rows[0].launches}`;
      console.log(this.title);
    } catch (error: unknown) {
      this.title = `Error SQLite: ${
        error instanceof Error ? error.message : String(error)
      }`;

      console.error('Prueba SQLite fallida:', error);
    }
  }
}
