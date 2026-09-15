import { Component, inject } from '@angular/core';
import { DatePipe, JsonPipe } from '@angular/common';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { IncidentLocalService } from '../../../../core/database/incident-local.service';
import { Incident } from '../../../../models/incident.model';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LocationService } from '../../../../core/services/location.service';
import {
  CapturedPhoto,
  PhotoService,
} from '../../../../core/services/photo.service';

// Pantalla temporal para probar la persistencia local.
@Component({
  selector: 'app-incident-test',
  standalone: true,
  imports: [
    DatePipe,
    MatButtonModule,
    MatCardModule,
    MatExpansionModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './incident-test.component.html',
  styleUrl: './incident-test.component.scss',
})
export class IncidentTestComponent {
  private readonly incidents = inject(IncidentLocalService);
  private readonly location = inject(LocationService);
  private readonly photos = inject(PhotoService);
  private readonly formBuilder = inject(FormBuilder);
  //UID ficticio (prueba local).
  private readonly userId = 'local-crud-test-user';

  // Reporte seleccionado para editar o eliminar.
  reportSelected: Incident | null = null;
  // Reportes activos del usuario de prueba.
  reports: Incident[] = [];
  //Reportes que esperan sincronización (tambien reportes eliminados).
  pending: Incident[] = [];
  message = 'Pulsa Consultar para recuperar los reportes guardados.';
  busy = false;

  //Reporte cuya versión se cargó en el formulario.
  editingReport: Incident | null = null;
  ///Controla si el formulario está visible.
  formVisible = false;

  // Foto nueva en memoria (se descarta al cancelar el formulario).
  draftPhoto: CapturedPhoto | null = null;
  // Imagen mostrada en el formulario.
  photoPreviewUrl: string | null = null;

  //Datos ingresados por el usuario.
  readonly form = this.formBuilder.nonNullable.group({
    //Rechaza títulos con solo espacios.
    title: [
      '',
      [
        Validators.required,
        Validators.maxLength(100),
        Validators.pattern(/\S/),
      ],
    ],
    description: [''],
  });

  // Abre el formulario vacío para crear un reporte.
  startCreate(): void {
    // Descarta la fotografía que todavía estaba en memoria.
    this.draftPhoto = null;
    this.photoPreviewUrl = null;
    this.editingReport = null;
    this.form.reset();
    this.formVisible = true;
  }

  // Abre la edición y recupera la vista previa del archivo guardado.
  async startEdit(): Promise<void> {
    if (!this.reportSelected) {
      return;
    }

    await this.execute(async () => {
      this.editingReport = { ...this.reportSelected! };
      this.draftPhoto = null;
      this.photoPreviewUrl = null;

      this.form.setValue({
        title: this.editingReport.title,
        description: this.editingReport.description ?? '',
      });

      this.formVisible = true;

      const path = this.editingReport.photoLocalPath;

      // Los reportes anteriores de prueba no tienen un archivo real.
      if (path?.startsWith('incident-photos/')) {
        this.photoPreviewUrl = await this.photos.getPreviewUrl(path);
      }

      this.message = 'Puedes editar el texto o tomar otra fotografía.';
    });
  }

  // Cierra el formulario sin guardar.
  cancelForm(): void {
    this.formVisible = false;
    this.editingReport = null;
    this.form.reset();
  }

  //Captura o reemplaza la fotografía del formulario.
  //Si se cancela la cámara, la fotografía anterior se conserva.
  async takePhoto(): Promise<void> {
    await this.execute(async () => {
      const photo = await this.photos.capture();

      this.draftPhoto = photo;
      this.photoPreviewUrl = photo.previewUrl;
      this.message = 'Foto capturada. Guarda el reporte para conservarla.';
    });
  }

  //Guarda el reporte y su fotografía.
  //Si SQLite falla después de escribir una foto nueva,
  //intenta eliminar ese archivo para no dejarlo sin reporte.
  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    await this.execute(async () => {
      const values = this.form.getRawValue();
      const current = this.editingReport;
      const capturedPhoto = this.draftPhoto;

      // Registros de prueba antiguos.
      const hasSavedPhoto =
        current?.photoLocalPath?.startsWith('incident-photos/') ||
        Boolean(current?.photoRemoteUrl);

      if (!capturedPhoto && !hasSavedPhoto) {
        throw new Error('Toma una fotografía antes de guardar.');
      }

      // Coordenadas originadales al editar.
      this.message = current
        ? 'Preparando cambios...'
        : 'Obteniendo ubicación...';

      const coordinates = current
        ? { latitude: current.latitude, longitude: current.longitude }
        : await this.location.getCurrentLocation();

      let newPhotoPath: string | null = null;

      try {
        if (capturedPhoto) {
          this.message = 'Guardando fotografía.';
          newPhotoPath = await this.photos.save(capturedPhoto);
        }

        const photoLocalPath = newPhotoPath ?? current?.photoLocalPath ?? null;

        this.message = 'Guardando reporte.';

        if (current) {
          this.reportSelected = await this.incidents.update(
            current.id,
            this.userId,
            {
              title: values.title,
              description: values.description,
              photoLocalPath,
              photoRemoteUrl: newPhotoPath ? null : current.photoRemoteUrl,
              latitude: current.latitude,
              longitude: current.longitude,
              temperatureC: current.temperatureC,
            },
            current.localRevision,
          );
        } else {
          if (!photoLocalPath) {
            throw new Error('No se pudo obtener la fotografía.');
          }

          // El formulario permanece abierto si la ubicación falla.
          this.message = 'Obteniendo ubicación del dispositivo.';

          const coordinates = await this.location.getCurrentLocation();

          this.message = 'Guardando reporte.';

          this.reportSelected = await this.incidents.create(this.userId, {
            title: values.title,
            description: values.description,
            photoLocalPath,
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
            temperatureC: null,
          });
        }
      } catch (error: unknown) {
        if (newPhotoPath) {
          try {
            const reports = await this.incidents.listPending(this.userId);
            const referenced = reports.some(
              (report) => report.photoLocalPath === newPhotoPath,
            );

            //Comprueba si la foto llegó a quedar referenciada.
            //Si la comprobación falla, conservamos el archivo por precaución.
            if (!referenced) {
              await this.photos.remove(newPhotoPath);
            }
          } catch (cleanupError) {
            console.error(
              'No se pudo obtener o limpiar la foto:',
              cleanupError,
            );
          }
        }

        throw error;
      }

      // El archivo ya está asociado al reporte; liberar la foto en memoria.
      this.cancelForm();
      await this.refresh();

      this.message = current
        ? 'Reporte y fotografía actualizados.'
        : 'Reporte guardado con fotografía y ubicación.';
    });
  }

  // Recupera los datos guardados, incluso después de reiniciar la app.
  async load(): Promise<void> {
    await this.execute(async () => {
      await this.refresh();

      this.message = `Consulta completada: ${this.reports.length} activos.`;
    });
  }

  // Selecciona un reporte del listado para operar sobre él.
  select(incident: Incident): void {
    this.reportSelected = incident;
    this.message = `Seleccionado: ${incident.title}`;
  }

  // Elimina lógicamente el reporte.
  async remove(): Promise<void> {
    await this.execute(async () => {
      const current = this.requireSelected();

      await this.incidents.softDelete(
        current.id,
        this.userId,
        current.localRevision,
      );

      this.reportSelected = null;

      await this.refresh();

      this.message =
        'Eliminado del listado. En pendientes debe aparecer con deletedAt.';
    });
  }

  // Comprueba que otra cuenta no pueda consultar el reporte por ID.
  async checkOtherUser(): Promise<void> {
    await this.execute(async () => {
      const current = this.requireSelected();

      const result = await this.incidents.findById(
        current.id,
        'another-test-user',
      );

      if (result !== null) {
        throw new Error('La consulta devolvió un reporte de otro usuario.');
      }

      this.message = 'Correcto: otro usuario obtiene null.';
    });
  }

  // Actualiza ambos listados y recupera la selección desde SQLite.
  private async refresh(): Promise<void> {
    this.reports = await this.incidents.listByUser(this.userId);
    this.pending = await this.incidents.listPending(this.userId);

    const selectedId = this.reportSelected?.id;

    this.reportSelected =
      this.reports.find((report) => report.id === selectedId) ??
      this.reports[0] ??
      null;
  }

  // Impide editar o eliminar si no hay un reporte seleccionado.
  private requireSelected(): Incident {
    if (!this.reportSelected) {
      throw new Error('Primero crea o selecciona un reporte.');
    }

    return this.reportSelected;
  }

  //Centralización manejo de errores (Bloquea botones cuando hay una operación en curso).
  private async execute(operation: () => Promise<void>): Promise<void> {
    if (this.busy) {
      return;
    }

    this.busy = true;
    this.message = 'Procesando...';

    try {
      await operation();
    } catch (error: unknown) {
      this.message = error instanceof Error ? error.message : String(error);

      console.error('Error en la prueba de incidentes:', error);
    } finally {
      this.busy = false;
    }
  }
}
