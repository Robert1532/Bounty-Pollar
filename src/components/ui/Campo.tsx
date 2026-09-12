'use client';

import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

const ENTRADA =
  'w-full rounded-2xl border border-borde bg-superficie px-4 py-3.5 text-tinta placeholder:text-tinta-3 focus:border-verde focus:outline-none';

export function Campo({
  etiqueta,
  ayuda,
  error,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { etiqueta: string; ayuda?: string; error?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-tinta-2">{etiqueta}</span>
      <input {...rest} className={ENTRADA} aria-invalid={Boolean(error)} />
      {ayuda && !error && <span className="mt-1.5 block text-xs text-tinta-3">{ayuda}</span>}
      {error && <span className="mt-1.5 block text-xs font-medium text-rojo">{error}</span>}
    </label>
  );
}

export function AreaTexto({
  etiqueta,
  ayuda,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { etiqueta: string; ayuda?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-tinta-2">{etiqueta}</span>
      <textarea {...rest} className={`${ENTRADA} min-h-24 resize-y`} />
      {ayuda && <span className="mt-1.5 block text-xs text-tinta-3">{ayuda}</span>}
    </label>
  );
}
