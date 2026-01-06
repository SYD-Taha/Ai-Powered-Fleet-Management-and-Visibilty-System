
export const getVehicleColor = (status: string) => {
  switch (status) {
    case "available": return "bg-green-500";
    case "dispatched": return "bg-blue-500";
    case "onRoute": return "bg-blue-500";
    case "working": return "bg-orange-500";
    case "idle": return "bg-yellow-500";
    case "refueling": return "bg-red-500";
    default: return "bg-gray-500";
  }
};

export const getFaultSeverityColor = (severity: string) => {
  switch (severity) {
    case "critical": return "text-red-500";
    case "high": return "text-orange-500";
    case "medium": return "text-yellow-500";
    case "low": return "text-blue-500";
    default: return "text-gray-500";
  }
};
