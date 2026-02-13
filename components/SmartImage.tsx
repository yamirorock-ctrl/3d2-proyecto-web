import React from 'react';
import { getUrl, revokeUrl } from '../services/imageStore';

interface Props extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  storageKey?: string;
  showError?: boolean;
  wrapperClassName?: string;
}

const SmartImage: React.FC<Props> = ({ src, storageKey, showError, wrapperClassName, ...rest }) => {
  const [resolved, setResolved] = React.useState<string | undefined>(undefined);
  const [loadError, setLoadError] = React.useState<boolean>(false);

  React.useEffect(() => {
    let active = true;
    let keyInUse: string | null = null;

    async function run() {
      let key = storageKey;
      if (!key && src && src.startsWith('lf:')) key = src.slice(3);
      if (key) {
        keyInUse = key;
        const url = await getUrl(key);
        if (active) {
          setResolved(url ?? undefined);
          setLoadError(false);
        }
      } else {
        // Evitar asignar 'lf:' directamente al src del <img>
        if (src && src.startsWith('lf:')) {
          setResolved(undefined);
        } else {
          setResolved(src);
        }
        setLoadError(false);
      }
    }

    run();

    return () => {
      active = false;
      if (keyInUse) revokeUrl(keyInUse);
    };
  }, [src, storageKey]);

  const base = (import.meta as any).env?.BASE_URL || '/';
  const fallback = `${base}placeholder.svg`;
  
  const containerStyle: React.CSSProperties = { position: 'relative', display: 'inline-block' };

  if (!resolved) {
    return (
      <div style={containerStyle} className={wrapperClassName}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <img src={fallback} {...rest} alt={rest.alt || 'Placeholder'} />
        {showError ? (
          <div style={{ position: 'absolute', bottom: 4, right: 4, background: 'rgba(220,38,38,0.9)', color: '#fff', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>
            Error al cargar
          </div>
        ) : null}
      </div>
    );
  }
  const userOnError = rest.onError as any;
  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    (e.currentTarget as HTMLImageElement).src = fallback;
    setLoadError(true);
    if (typeof userOnError === 'function') userOnError(e);
  };
  // eslint-disable-next-line jsx-a11y/alt-text
  return (
    <div style={containerStyle} className={wrapperClassName}>
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <img src={resolved} onError={handleError} {...rest} />
      {showError && loadError ? (
        <div style={{ position: 'absolute', bottom: 4, right: 4, background: 'rgba(220,38,38,0.9)', color: '#fff', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>
          Error al cargar
        </div>
      ) : null}
    </div>
  );
};

export default SmartImage;
