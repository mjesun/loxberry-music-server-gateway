'use strict';

module.exports = class List {
  constructor(musicServer, url) {
    this._musicServer = musicServer;
    this._url = url;

    this.reset();
  }

  reset() {
    this._total = Infinity;
    this._items = [];
  }

  async get(start, length) {
    const items = this._items;
    const end = start + length;

    while (items.length < this._total && items.length < end) {
      await this._fetch(items.length);
    }

    return {
      total: this._total,
      items: items.slice(start, end),
    };
  }

  async insert(position, ...items) {
    await this._musicServer.call('POST', this._url + '/' + position, items);

    this.reset();
  }

  async replace(position, ...items) {
    await this._musicServer.call('PUT', this._url + '/' + position, items);

    this.reset();
  }

  async delete(position, length) {
    await this._musicServer.call(
      'DELETE',
      this._url + '/' + position + '/' + length,
    );

    this.reset();
  }

  async _fetch(start) {
    let chunk = {items: [], total: 0};

    try {
      chunk = await this._musicServer.call('GET', this._url + '/' + start);
    } catch (err) {
      console.error('[ERR!] Could not fetch list fragment: ' + err.message);
    }

    this._items.splice(start, Infinity, ...chunk.items);
    this._total = chunk.total;
  }
};
