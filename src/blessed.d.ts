import 'blessed';

declare module 'blessed' {
  namespace Widgets {
    interface ListElement {
      /** Row elements. Present at runtime; missing from @types/blessed. */
      items: BlessedElement[];
      /** Index of the highlighted row. Present at runtime; missing from @types/blessed. */
      selected: number;
    }
  }
}
