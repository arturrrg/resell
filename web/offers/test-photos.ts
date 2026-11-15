/** Numbered, synthetic upload fixtures. Never use them in a published advert. */
export async function numberedTestPhotos(count: number): Promise<File[]> {
  const files: File[] = [];
  for (let index = 1; index <= count; index++) {
    const canvas = document.createElement("canvas");
    canvas.width = index % 2 ? 1200 : 1600;
    canvas.height = index % 2 ? 1600 : 1200;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createLinearGradient(
      0,
      0,
      canvas.width,
      canvas.height,
    );
    gradient.addColorStop(0, `hsl(${index * 31}, 28%, 23%)`);
    gradient.addColorStop(1, "#08090c");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#ffffff12";
    for (let x = 0; x < canvas.width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    ctx.textAlign = "center";
    ctx.fillStyle = "#f5f5f7";
    ctx.font = "700 320px sans-serif";
    ctx.fillText(
      String(index).padStart(2, "0"),
      canvas.width / 2,
      canvas.height / 2 + 80,
    );
    ctx.font = "600 64px sans-serif";
    ctx.fillText("Resell.", canvas.width / 2, 140);
    ctx.font = "32px sans-serif";
    ctx.fillStyle = "#d0d0d8";
    ctx.fillText(
      "UNPUBLISHED PHOTO TRANSFER TEST",
      canvas.width / 2,
      canvas.height - 100,
    );
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) =>
          b
            ? resolve(b)
            : reject(Error("Could not create the test photograph.")),
        "image/jpeg",
        0.94,
      ),
    );
    files.push(
      new File([blob], `resell-test-${String(index).padStart(2, "0")}.jpg`, {
        type: "image/jpeg",
      }),
    );
    canvas.width = canvas.height = 1;
  }
  return files;
}
