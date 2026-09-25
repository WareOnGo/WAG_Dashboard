import { useState } from 'react';

/** Explicit variant pairing; changing the preview never changes its identity. */
export default function ImageWithFallback({ as = 'img', originalUrl, webpUrl, variantUrl = webpUrl, onError, onFallback, ...props }) {
  const Component = as;
  const preferred = variantUrl || originalUrl;
  const [failedPrimary, setFailedPrimary] = useState(null);
  const src = failedPrimary === preferred ? originalUrl : preferred;
  return <Component {...props} src={src} onError={event => {
    if (src !== originalUrl) {
      setFailedPrimary(preferred);
      onFallback?.();
    }
    else onError?.(event);
  }} />;
}
