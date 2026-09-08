export const COREFLOW_APP_URL =
  (
    import.meta.env
      .VITE_COREFLOW_APP_URL
    ?? "http://localhost:5174"
  ).replace(/\/$/, "");


export type CoreFlowDestination =
  | "profile"
  | "users"
  | "organizations"
  | "settings";


export function getCoreFlowUrl(
  destination: CoreFlowDestination
) {
  const params =
    new URLSearchParams();

  params.set(
    "from",
    "devisflow"
  );

  switch (destination) {
    case "profile":
      params.set(
        "profile",
        "1"
      );
      break;

    case "users":
      params.set(
        "page",
        "users"
      );
      break;

    case "organizations":
      params.set(
        "page",
        "organizations"
      );
      break;

    case "settings":
      params.set(
        "page",
        "settings"
      );
      break;
  }

  return (
    `${COREFLOW_APP_URL}/?`
    + params.toString()
  );
}
