'use strict';

const MusicList = require('./music-list');

module.exports = class MusicZone {
  constructor(musicServer, id) {
    this._musicServer = musicServer;
    this._id = id;

    this._setEmptyTrack();

    this._updateId = undefined;
    this._updateTime = NaN;

    this._player = {
      id: '',
      mode: 'stop',
      time: 0,
      volume: 50,
      repeat: 0,
      shuffle: 0,
    };

    this._favorites = new MusicList(musicServer, this._url() + '/favorites');
    this._queue = new MusicList(musicServer, this._url() + '/queue');

    this._getState();
  }

  getFavoritesList() {
    return this._favorites;
  }

  getQueueList() {
    return this._queue;
  }

  getTrack() {
    return this._track;
  }

  getMode() {
    return this._player.mode;
  }

  getTime() {
    const delta = Date.now() - this._updateTime;
    const player = this._player;

    return Math.min(
      player.time + (player.mode === 'play' ? delta : 0),
      this._track.duration,
    );
  }

  getVolume() {
    return this._player.volume;
  }

  getRepeat() {
    return this._player.repeat;
  }

  getShuffle() {
    return this._player.shuffle;
  }

  async play(id) {
    this._setEmptyTrack();
    this._player.time = 0;
    this._setMode('buffer');

    try {
      await this._sendPlayerCommand('POST', id ? '/play/' + id : '/play');
    } catch (err) {
      console.error('[ERR!] Default behavior for "play": ' + err.message);

      this._setMode('play');
    }
  }

  async pause() {
    this._setMode('pause');

    try {
      await this._sendPlayerCommand('POST', '/pause');
    } catch (err) {
      console.error('[ERR!] Default behavior for "pause": ' + err.message);
    }
  }

  async resume() {
    this._player.time = this.getTime();
    this._setMode('buffer');

    try {
      await this._sendPlayerCommand('POST', '/resume');
    } catch (err) {
      console.error('[ERR!] Default behavior for "resume": ' + err.message);

      this._setMode('play');
    }
  }

  async time(time) {
    this._player.time = time;
    this._setMode('buffer');

    try {
      await this._sendPlayerCommand('POST', '/time/' + time);
    } catch (err) {
      console.error('[ERR!] Default behavior for "time": ' + err.message);

      this._setMode('play');
      this._player.time = time;
      this._updateTime = Date.now();
    }

    this._pushAudioEvent();
  }

  async volume(volume) {
    this._player.volume = Math.min(Math.max(+volume, 0), 100);

    try {
      await this._sendPlayerCommand('POST', '/volume/' + this._volume);
    } catch (err) {
      console.error('[ERR!] Default behavior for "volume": ' + err.message);
    }

    this._pushAudioEvent();
  }

  async repeat(repeat) {
    if (repeat === 0 || repeat === 1 || repeat === 2) {
      this._player.repeat = repeat;
    } else {
      this._player.repeat = (this._repeat + 1) % 3;
    }

    try {
      await this._sendPlayerCommand('POST', '/repeat/' + repeat);
    } catch (err) {
      console.error('[ERR!] Default behavior for "repeat": ' + err.message);
    }

    this._pushAudioEvent();
  }

  async shuffle(shuffle) {
    if (shuffle === 0 || shuffle === 1) {
      this._player.shuffle = shuffle;
    } else {
      this._player.shuffle = (this._shuffle + 1) % 2;
    }

    try {
      await this._sendPlayerCommand('POST', '/shuffle/' + shuffle);
    } catch (err) {
      console.error('[ERR!] Default behavior for "shuffle": ' + err.message);
    }

    this._pushAudioEvent();
  }

  async previous() {
    this._setEmptyTrack();
    this._player.time = 0;
    this._setMode('buffer');

    try {
      await this._sendPlayerCommand('POST', '/previous');
    } catch (err) {
      console.error('[ERR!] Default behavior for "previous": ' + err.message);

      this._setMode('play');
    }
  }

  async next() {
    this._setEmptyTrack();
    this._player.time = 0;
    this._setMode('buffer');

    try {
      await this._sendPlayerCommand('POST', '/next');
    } catch (err) {
      console.error('[ERR!] Default behavior for "next": ' + err.message);

      this._setMode('play');
    }
  }

  async _getState() {
    try {
      await this._sendPlayerCommand('GET', '/state');
    } catch (err) {
      console.error('[ERR!] Could not get player "state": ' + err.message);
    }
  }

  _setMode(mode) {
    if (this._player.mode !== mode) {
      if (mode === 'play' || mode === 'buffer') {
        if (!this._updateId) {
          this._updateId = setInterval(this._getState.bind(this), 5000);
        }
      } else {
        if (this._updateId) {
          this._updateId = clearInterval(this._updateId);
        }
      }

      this._player.mode = mode;
    }

    this._player.time = this.getTime();
    this._updateTime = Date.now();

    this._pushAudioEvent();
  }

  _pushAudioEvent() {
    if (!this._audioEventSent) {
      this._audioEventSent = true;

      setTimeout(() => {
        this._musicServer.pushAudioEvent(this);
        this._audioEventSent = false;
      }, 25);
    }
  }

  async _sendPlayerCommand(method, url, body) {
    const data = await this._musicServer.call(method, this._url() + url, body);

    if (data.track) {
      this._track = data.track;
    } else {
      this._setEmptyTrack();
    }

    if (data.player) {
      this._setMode(data.player.mode);
      Object.assign(this._player, data.player);
      this._updateTime = Date.now();
    }

    this._pushAudioEvent();
  }

  _setEmptyTrack() {
    this._track = {
      id: '',
      title: '',
      album: '',
      artist: '',
      duration: 0,
      image: null,
    };
  }

  _url() {
    return '/zone/' + this._id;
  }
};
