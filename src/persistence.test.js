jest.mock("jspdf", () => {
  return jest.fn().mockImplementation(() => ({
    addImage: jest.fn(),
    addFileToVFS: jest.fn(),
    addFont: jest.fn(),
    setFont: jest.fn(),
    setFontSize: jest.fn(),
    text: jest.fn(),
    save: jest.fn(),
  }));
});
jest.mock("jspdf-autotable", () => jest.fn());

import { packStateForCloud, unpackStateFromCloud } from "./App";

describe("state persistence helpers", () => {
  it("preserves realtimeOrders flag and converts dates when packing/unpacking", () => {
    const sampleDate = new Date("2024-02-03T04:05:06.000Z");
    const state = {
      menu: [{ id: "m1", name: "Burger", price: 40, isCombo: true }],
      extraList: [{ id: "e1", name: "Cheese" }],
      beverageList: [
        {
          id: "b1",
          name: "Cola",
          price: 12,
          uses: { i1: 1 },
          color: "#123456",
          active: true,
        },
      ],
      orders: [
        {
          orderNo: 1,
          worker: "Alice",
          payment: "Cash",
          paymentParts: [{ method: "Cash", amount: 10.8 }],
          orderType: "dine_in",
          deliveryFee: 0,
          total: 10.8,
          itemsTotal: 10.8,
          discountPercentage: 0,
          discountAmount: 1.2,
          cashReceived: 20,
          changeDue: 9.2,
          done: true,
          voided: false,
          note: "Thanks",
          date: sampleDate,
          restockedAt: sampleDate,
          cart: [
            {
              id: "m1",
              name: "Burger",
              qty: 1,
              price: 40,
              isCombo: true,
              comboBeverage: {
                id: "b1",
                beverageId: "b1",
                name: "Cola",
                price: 0,
                included: true,
                itemType: "combo-beverage",
                qtyPerCombo: 1,
              },
            },
            {
              id: "beverage-b1",
              beverageId: "b1",
              itemType: "beverage",
              name: "Cola",
              qty: 2,
              price: 12,
            },
          ],
        },
      ],
      inventory: [{ id: "i1", name: "Patty" }],
      nextOrderNo: 2,
      workerProfiles: [{ id: "w1", name: "Alice" }],
      workerSessions: [
        { id: "s1", name: "Alice", signInAt: sampleDate, signOutAt: sampleDate },
      ],
      dark: true,
      workers: [{ id: "w1", name: "Alice" }],
      paymentMethods: ["Cash", "Card"],
      inventoryLocked: false,
      inventorySnapshot: [{ id: "i1", qty: 3 }],
      inventoryLockedAt: sampleDate,
      adminPins: { alice: "1234" },
      orderTypes: [{ id: "ot1", name: "Dine in" }],
      defaultDeliveryFee: 5,
      expenses: [{ id: "ex1", amount: 10, date: sampleDate }],
      purchases: [{ id: "p1", amount: 50, date: sampleDate }],
      purchaseCategories: [{ id: "cat1", name: "Food" }],
      customers: [
        {
          id: "c1",
          lastOrderAt: sampleDate,
          firstOrderAt: sampleDate,
          updatedAt: sampleDate,
        },
      ],
      deliveryZones: [{ id: "z1", name: "Zone" }],
      dayMeta: {
        startedAt: sampleDate,
        endedAt: sampleDate,
        lastReportAt: sampleDate,
        resetAt: sampleDate,
        reconciledAt: sampleDate,
        shiftChanges: [{ at: sampleDate }],
      },
      bankTx: [{ id: "b1", date: sampleDate, amount: 100 }],
      reconHistory: [{ id: "r1", at: sampleDate }],
      realtimeOrders: false,
        onlineOrdersRaw: [
        {
          id: "o1",
          createdAt: sampleDate,
          createdAtMs: sampleDate.getTime(),
          date: sampleDate,
          restockedAt: sampleDate,
          whatsappSentAt: sampleDate,
          total: 42,
          itemsTotal: 40,
          deliveryFee: 2,
          cart: [
            {
              id: "c1",
              name: "Burger",
              qty: 1,
              price: 40,
              extras: [],
            },
          ],
          status: "new",
          source: "online",
          channel: "online",
        },
      ],
      onlineOrderStatus: {
        "o1": { state: "imported", lastUpdateAt: 123, lastSeenAt: 456 },
      },
      lastSeenOnlineOrderTs: sampleDate.getTime(),
    };

    const packed = packStateForCloud(state);

    expect(packed.realtimeOrders).toBe(false);
    expect(packed.menu[0].isCombo).toBe(true);
    expect(packed.beverages[0]).toMatchObject({
      id: "b1",
      name: "Cola",
      price: 12,
      uses: { i1: 1 },
      active: true,
    });
    expect(packed.orders[0].cart[0].comboBeverage.name).toBe("Cola");
    expect(packed.orders[0].cart[1].itemType).toBe("beverage");
    expect(packed.workerSessions[0].signInAt).toEqual(sampleDate.toISOString());
    expect(packed.onlineOrders[0].createdAt).toEqual(sampleDate.toISOString());
    expect(packed.lastSeenOnlineOrderTs).toBe(sampleDate.getTime());

    const unpacked = unpackStateFromCloud(packed);

    expect(unpacked.realtimeOrders).toBe(false);
    expect(unpacked.menu[0].isCombo).toBe(true);
    expect(unpacked.beverageList[0]).toMatchObject({
      id: "b1",
      name: "Cola",
      price: 12,
      uses: { i1: 1 },
      active: true,
      deleted: false,
    });
    expect(unpacked.orders[0].cart[0].comboBeverage.name).toBe("Cola");
    expect(unpacked.orders[0].cart[1].beverageId).toBe("b1");
    expect(unpacked.workerSessions[0].signInAt).toBeInstanceOf(Date);
    expect(unpacked.orders[0].date).toBeInstanceOf(Date);
    expect(unpacked.orders[0].discountPercentage).toBe(0);
    expect(unpacked.orders[0].discountAmount).toBe(1.2);
    expect(unpacked.onlineOrdersRaw[0].createdAt).toBeInstanceOf(Date);
    expect(unpacked.onlineOrderStatus.o1.state).toBe("imported");
    expect(unpacked.lastSeenOnlineOrderTs).toBe(sampleDate.getTime());
  });
});
