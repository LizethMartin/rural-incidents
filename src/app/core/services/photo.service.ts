import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Camera,  EncodingType } from '@capacitor/camera';
import { Directory, Filesystem } from '@capacitor/filesystem';

/** Fotografía capturada que todavía no se ha guardado como archivo. */
export interface CapturedPhoto {
    base64: string;
    previewUrl: string;
}

//Captura fotografías y administra su almacenamiento local (Base64 se utiliza temporalmente en memoria).
@Injectable({
    providedIn: 'root',
})
export class PhotoService {
    // Abre la cámara y devuelve la fotografía para previsualizarla.
    async capture(): Promise<CapturedPhoto> {
        if (!Capacitor.isNativePlatform()) {
            throw new Error('Prueba la cámara en Android o iOS.');
        }

        // Abre directamente la cámara
        const photo = await Camera.takePhoto({
            quality: 75,
            targetWidth: 1280,
            targetHeight: 1280,
            encodingType: EncodingType.JPEG,
            correctOrientation: true,
            saveToGallery: false,
        });

        if (!photo.uri) {
            throw new Error('No se obtuvo el archivo de la fotografía.');
        }

        // Devuelve una URI del archivo. (Filesystem devuelve su contenido en Base64 en nativo).
        const file = await Filesystem.readFile({
            path: photo.uri,
        });

        if (typeof file.data !== 'string' || !file.data) {
            throw new Error('No se pudo leer la fotografía.');
        }

        return {
            base64: file.data,
            previewUrl: `data:image/jpeg;base64,${file.data}`,
        };
    }

    /**
     * Guarda un JPEG en el directorio privado de datos de la aplicación.
     * Devuelve una ruta relativa que puede persistirse en SQLite.
     */
    async save(photo: CapturedPhoto): Promise<string> {
        const path = `incident-photos/${crypto.randomUUID()}.jpg`;

        await Filesystem.writeFile({
            path,
            data: photo.base64,
            directory: Directory.Data,
            recursive: true,
        });

        return path;
    }


    // Elimina un archivo nuevo cuando falla el guardado de su reporte.
    async remove(path: string): Promise<void> {
        await Filesystem.deleteFile({
            path,
            directory: Directory.Data,
        });
    }

    //Convierte la ruta guardada en SQLite en una URL
    async getPreviewUrl(path: string): Promise<string> {
        // Obtiene la URI completa del archivo en el almacenamiento privado.
        const result = await Filesystem.getUri({
            path,
            directory: Directory.Data,
        });

        // Convierte la URI nativa a una URL accesible desde la pantalla.
        return Capacitor.convertFileSrc(result.uri);
    }
}
