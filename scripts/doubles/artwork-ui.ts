import type { ReactNode } from 'react';

/** Solo il bordo nativo del render: nessun fetch e nessuna cache reale. */
export const renderedImages: Record<string, unknown>[] = [];

export function Image(props: Record<string, unknown>) {
  renderedImages.push(props);
  return null;
}

export const View = ({ children }: { children?: ReactNode }) => children;
export const Ionicons = () => null;
export default Ionicons;
export const StyleSheet = {
  create: <T>(styles: T): T => styles,
  absoluteFill: {},
};
