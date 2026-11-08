import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          background: "#1c1917",
          color: "#f3efe6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          fontFamily: "Georgia",
        }}
      >
        C
      </div>
    ),
    size,
  );
}
