import { fireEvent, render, screen } from '@testing-library/react';
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

const App = require("./App").default;

test("renders POS header", () => {
  render(<App />);
    expect(screen.getByText(/burger truck pos/i)).toBeInTheDocument();

});

const clickTile = (label) => {
  const tile = screen.getByText(label).closest('[role="button"]');
  expect(tile).toBeTruthy();
  fireEvent.click(tile);
};

test("adds multiple selected items and extras with independent quantities", () => {
  render(<App />);

  clickTile("Single Smashed Patty");
  clickTile("Double Smashed Patty");
  clickTile("Cheese");
  clickTile("Ranch");
  fireEvent.click(screen.getByRole("button", { name: "Increase Single Smashed Patty quantity" }));
  fireEvent.click(screen.getByRole("button", { name: "Increase Ranch quantity" }));
  fireEvent.click(screen.getByRole("button", { name: "Add to Cart" }));

  const cartText = document.querySelector(".cart-pane")?.textContent || "";
  expect(cartText).toMatch(/Single Smashed Patty/);
  expect(cartText).toMatch(/Double Smashed Patty/);
  expect(cartText).toMatch(/Cheese/);
  expect(cartText).toMatch(/Ranch/);
  expect(cartText).toMatch(/375\.00/);
  expect(
    screen.queryByRole("button", { name: "Increase Single Smashed Patty quantity" })
  ).not.toBeInTheDocument();
});

test("adds extras without requiring a selected burger or item", () => {
  render(<App />);

  clickTile("Ranch");
  clickTile("Cheese");
  fireEvent.click(screen.getByRole("button", { name: "Increase Ranch quantity" }));
  fireEvent.click(screen.getByRole("button", { name: "Add to Cart" }));

  const cartText = document.querySelector(".cart-pane")?.textContent || "";
  expect(cartText).toMatch(/Ranch/);
  expect(cartText).toMatch(/Cheese/);
  expect(cartText).toMatch(/45\.00/);
  expect(cartText).not.toMatch(/Single Smashed Patty/);
});
