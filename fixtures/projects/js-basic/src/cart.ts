export interface Item {
  name: string;
  price: number;
}

export class Cart {
  private items: Item[] = [];

  add(item: Item): void {
    this.items.push(item);
  }

  total(): number {
    return this.items.reduce((sum, item) => sum + item.price, 0);
  }

  count(): number {
    return this.items.length;
  }
}
