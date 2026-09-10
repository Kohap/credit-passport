import { ImageResponse } from "next/og";

export const dynamic = "force-static";

export const size = {
  width: 64,
  height: 64,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#4a1c28",
          border: "3px solid #d6cbb8",
          color: "#d6cbb8",
          display: "flex",
          fontFamily: "Georgia, serif",
          fontSize: 28,
          fontWeight: 700,
          height: "100%",
          justifyContent: "center",
          letterSpacing: 0,
          width: "100%",
        }}
      >
        CP
      </div>
    ),
    size,
  );
}
