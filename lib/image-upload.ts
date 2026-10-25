// Keep the latest resize/alignment/caption settings when an asynchronous upload completes.
export function imageUploadProps<T extends { previewWidth?: number }>(props: T, url: string, name: string, placeholderWidth?: number) {
  const width = props.previewWidth ?? placeholderWidth;
  return { ...props, url, name, ...(width && Number.isFinite(width) && width > 0 ? { previewWidth: width } : {}) };
}
