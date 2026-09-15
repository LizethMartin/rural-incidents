//Perfil del usuario autenticado - contraseña administrada por Firebase Authentication
export interface UserProfile {
    uid: string; // Identificador único del usuario, asignado por firebase Authentication
    email: string;
    fullName: string; // Nombre completo registrado por el usuario
}
