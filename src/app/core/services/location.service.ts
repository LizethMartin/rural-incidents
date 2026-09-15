import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

// Datos de ubicación utilizados por la aplicación.
export interface DeviceLocation {
    latitude: number;
    longitude: number;

    //Precisión estimada en metros(valor menor es mejor).
    accuracy: number;
}

//Obtiene una ubicación puntual del dispositivo.
@Injectable({
    providedIn: 'root',
})
export class LocationService {
    /**
     * Comprueba permisos y solicita una ubicación actual.
     *
     * Puede fallar si el usuario rechaza el permiso,
     * desactiva la ubicación o no se obtiene señal a tiempo.
     */
    async getCurrentLocation(): Promise<DeviceLocation> {
        if (!Capacitor.isNativePlatform()) {
            throw new Error('Prueba la ubicación en Android o iOS.');
        }

        try {
            let permissions = await Geolocation.checkPermissions();

            /**
             * Solicitamos permisos solo cuando todavía no tenemos ninguno.
             * Aceptamos ubicación aproximada si el usuario la eligió.
             */
            if (
                permissions.location !== 'granted' &&
                permissions.coarseLocation !== 'granted'
            ) {
                // Pide permiso y guarda ese resultado en la misma variable.
                permissions = await Geolocation.requestPermissions({
                    permissions: ['location'],
                });
            }

            //Si se solicitaron los persmisos y el usuario los rechazó, no podemos continuar.
            if (
                permissions.location !== 'granted' &&
                permissions.coarseLocation !== 'granted'
            ) {
                throw new Error(
                    'Necesitamos permiso de ubicación. Puedes habilitarlo ' +
                        'en Ajustes → Aplicaciones → Incidentes Rurales → Permisos.',
                );
            }

            const position = await Geolocation.getCurrentPosition({
                // Solicita precisión alta cuando el permiso lo permite.
                enableHighAccuracy: true,

                // Espera hasta 30 segundos para obtener la ubicación.
                timeout: 30000, 

                // Solicita una posición nueva, sin aceptar una antigua en caché.
                maximumAge: 0,

                // Permite recurrir al proveedor nativo en Android.
                enableLocationFallback: true,
            });

            return {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
            };
        } catch (error: unknown) {
            // Conserva el detalle técnico para diagnosticar el fallo.
            console.error('No se pudo obtener la ubicación:', error);

            // Mantiene el mensaje explícito de permisos generado arriba.
            if (
                error instanceof Error &&
                error.message.startsWith('Necesitamos permiso')
            ) {
                throw error;
            }

            throw new Error(
                'No se pudo obtener la ubicación. Comprueba que esté activada, ' +
                'revisa los permisos y vuelve a intentarlo.',
            );
        }
    }
}
