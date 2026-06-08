const fs = require("fs");
const path = require("path");

const appPath = path.join(__dirname, "..", "src", "App.js");
let text = fs.readFileSync(appPath, "utf8");
let changed = false;

const fixedKeyMarker = "record.cloudId ? `cloud_${record.cloudId}` : \"\"";

if (!text.includes(fixedKeyMarker)) {
  const newGetStableRecordKey = `function getStableRecordKey(record, fallbackPrefix = "row", index = 0) {
  if (!record || typeof record !== "object") return \`${'${fallbackPrefix}'}_${'${index}'}\`;

  const isOrderLike =
    fallbackPrefix === "order" ||
    record.orderNo != null ||
    record.cloudId ||
    record.idemKey ||
    record.onlineOrderId ||
    record.onlineOrderKey;

  const candidates = isOrderLike
    ? [
        record.cloudId ? \`cloud_${'${record.cloudId}'}\` : "",
        record.idemKey ? \`idem_${'${record.idemKey}'}\` : "",
        record.onlineOrderKey ? \`online_key_${'${record.onlineOrderKey}'}\` : "",
        record.onlineOrderId ? \`online_id_${'${record.onlineOrderId}'}\` : "",
        record.id,
        record.orderNo != null
          ? \`order_${'${record.dayId || orderDayBucket(record)}'}_${'${record.orderNo}'}\`
          : "",
        record.channelOrderNo
          ? \`channel_${'${record.dayId || orderDayBucket(record)}'}_${'${record.channelOrderNo}'}\`
          : "",
      ]
    : [
        record.id,
        record.sessionId,
        record.dayId,
        record.name && (record.signInAt || record.date || record.at)
          ? \`${'${record.name}'}_${'${record.signInAt || record.date || record.at}'}\`
          : "",
      ];

  return String(
    candidates.find((v) => v !== undefined && v !== null && String(v) !== "") ||
      \`${'${fallbackPrefix}'}_${'${index}'}\`
  );
}
`;

  const next = text.replace(
    /function getStableRecordKey\(record, fallbackPrefix = "row", index = 0\) \{[\s\S]*?\n\}\n\nfunction recordUpdatedMs/,
    `${newGetStableRecordKey}\nfunction recordUpdatedMs`
  );

  if (next === text) {
    throw new Error("Could not patch getStableRecordKey in src/App.js");
  }

  text = next;
  changed = true;
}

const oldCheckoutCloudIdUpdate = `        setOrders((prev) =>
          prev.map((oo) =>
            oo.orderNo === order.orderNo ? { ...oo, cloudId: ref.id, syncStatus: SYNC_STATUS.synced } : oo
          )
        );`;

const newCheckoutCloudIdUpdate = `        setOrders((prev) =>
          prev.map((oo) =>
            oo.idemKey === order.idemKey
              ? { ...oo, cloudId: ref.id, syncStatus: SYNC_STATUS.synced }
              : oo
          )
        );`;

if (text.includes(oldCheckoutCloudIdUpdate)) {
  text = text.replace(oldCheckoutCloudIdUpdate, newCheckoutCloudIdUpdate);
  changed = true;
} else if (!text.includes("oo.idemKey === order.idemKey")) {
  throw new Error("Could not patch checkout cloudId update in src/App.js");
}

if (changed) {
  fs.writeFileSync(appPath, text, "utf8");
  console.log("Applied Orders Board Live fix to src/App.js");
} else {
  console.log("Orders Board Live fix already applied");
}
