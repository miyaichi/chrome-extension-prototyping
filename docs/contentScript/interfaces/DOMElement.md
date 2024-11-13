[**chrome-extension-template**](../../README.md) • **Docs**

***

[chrome-extension-template](../../modules.md) / [contentScript](../README.md) / DOMElement

# Interface: DOMElement

Represents a serialized DOM element with its properties and children

## Properties

### children

> **children**: [`DOMElement`](DOMElement.md)[]

Array of child elements

#### Defined in

src/contentScript/contentScript.ts:19

***

### classes?

> `optional` **classes**: `string`[]

Array of element's CSS classes

#### Defined in

src/contentScript/contentScript.ts:15

***

### id?

> `optional` **id**: `string`

Element's ID attribute if present

#### Defined in

src/contentScript/contentScript.ts:13

***

### path

> **path**: `number`[]

Array representing the element's path in the DOM tree

#### Defined in

src/contentScript/contentScript.ts:21

***

### tag

> **tag**: `string`

HTML tag name of the element

#### Defined in

src/contentScript/contentScript.ts:11

***

### textContent?

> `optional` **textContent**: `string`

Combined text content of the element's direct text nodes

#### Defined in

src/contentScript/contentScript.ts:17
