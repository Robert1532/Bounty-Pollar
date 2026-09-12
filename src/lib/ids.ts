import { customAlphabet, nanoid } from 'nanoid';

/** Ids internos: url-safe, cortos, imposibles de adivinar. */
export const nuevoId = (): string => nanoid(21);

/**
 * Id publico del trato: 8 caracteres sin vocales ni simbolos ambiguos, porque
 * el link se dicta por telefono y se lee en un QR. 28^8 ≈ 3.8e11 combinaciones,
 * mas que suficiente para que nadie encuentre un trato ajeno probando.
 */
export const nuevoIdTrato = customAlphabet('346789ABCDEFGHJKLMNPQRTUVWXY', 8);
