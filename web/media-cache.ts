type Dimensions = { width: number; height: number };
type ImageEntry = {
  promise: Promise<Dimensions>;
  image: HTMLImageElement | null;
  retained: boolean;
  users: number;
  done: boolean;
  cancel: () => void;
};
const images = new Map<string, ImageEntry>();
const aborted = () =>
  new DOMException("Image preparation cancelled", "AbortError");
export function prepareImage(
  url: string,
  priority: "auto" | "high" = "auto",
  signal?: AbortSignal,
): Promise<Dimensions> {
  if (signal?.aborted) return Promise.reject(aborted());
  let entry = images.get(url);
  if (!entry) {
    const img = new Image();
    let resolve!: (size: Dimensions) => void, reject!: (error: Error) => void;
    const created: ImageEntry = {
      promise: new Promise((yes, no) => {
        resolve = yes;
        reject = no;
      }),
      image: img,
      retained: false,
      users: 0,
      done: false,
      cancel: () => {},
    };
    const forget = () => {
      if (images.get(url) === created) images.delete(url);
    };
    created.cancel = () => {
      if (created.done) return;
      created.done = true;
      img.onload = null;
      img.onerror = null;
      img.src = "";
      created.image = null;
      created.cancel = () => {};
      forget();
      reject(aborted());
    };
    img.fetchPriority = priority;
    img.decoding = "async";
    img.onload = async () => {
      try {
        await img.decode();
      } catch {}
      if (created.done) return;
      created.done = true;
      created.image = null;
      created.cancel = () => {};
      img.onload = null;
      img.onerror = null;
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      if (created.done) return;
      created.done = true;
      created.image = null;
      created.cancel = () => {};
      img.onload = null;
      img.onerror = null;
      forget();
      reject(Error("Image unavailable"));
    };
    images.set(url, created);
    entry = created;
    if (images.size > 36) images.delete(images.keys().next().value!);
    img.src = url;
  }
  if (priority === "high" && entry.image) entry.image.fetchPriority = "high";
  if (!signal) {
    entry.retained = true;
    return entry.promise;
  }
  entry.users++;
  const active = entry;
  return new Promise((resolve, reject) => {
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      signal.removeEventListener("abort", cancel);
      active.users--;
      if (!active.users && !active.retained && !active.done) active.cancel();
    };
    const cancel = () => {
      release();
      reject(aborted());
    };
    signal.addEventListener("abort", cancel, { once: true });
    active.promise.then(
      (size) => {
        release();
        resolve(size);
      },
      (error) => {
        release();
        reject(error);
      },
    );
  });
}
