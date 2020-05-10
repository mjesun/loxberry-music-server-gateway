'use strict';

const http = require('http');
const querystring = require('querystring');
const websocket = require('websocket');

const MusicList = require('./music-list');
const MusicZone = require('./music-zone');

const headers = {
  'Content-Type': 'text/plain; charset=utf-8',
};

module.exports = class MusicServer {
  constructor(config) {
    const zones = [];

    this._config = config;
    this._zones = zones;

    this._imageStore = Object.create(null);

    this._favorites = new MusicList(this, '/favorites');
    this._playlists = new MusicList(this, '/playlists');
    this._library = new MusicList(this, '/library');

    this._wsConnections = new Set();
    this._miniserverIp = null;

    for (let i = 0; i < 20; i++) {
      zones[i] = new MusicZone(this, i + 1);
    }
  }

  start() {
    if (this._httpServer || this._wsServer || this._dgramServer) {
      throw new Error('Music server already started');
    }

    const httpServer = http.createServer(async (req, res) => {
      console.log('[HTTP] Received message: ' + req.url);

      try {
        res.writeHead(200, headers);
        res.end(await this._handler(req.url));
      } catch (err) {
        res.writeHead(500, headers);
        res.end(err.stack);
      }
    });

    const wsServer = new websocket.server({
      httpServer,
      autoAcceptConnections: true,
    });

    wsServer.on('connect', (connection) => {
      this._wsConnections.add(connection);

      connection.on('message', async (message) => {
        console.log('[WSCK] Received message: ' + message.utf8Data);

        if (message.type !== 'utf8') {
          throw new Error('Unknown message type: ' + message.type);
        }

        connection.sendUTF(await this._handler(message.utf8Data));
      });

      connection.on('close', () => {
        this._wsConnections.delete(connection);
      });

      connection.send('LWSS V 2.3.9.2 | ~API:1.6~');
    });

    httpServer.listen(this._config.port);

    setInterval(this._pushAudioEvents.bind(this, this._zones), 4000);

    this._httpServer = httpServer;
    this._wsServer = wsServer;
  }

  call(method, uri, body = null) {
    const url = this._config.gateway + uri;

    const data =
      method === 'POST' || method === 'PUT'
        ? JSON.stringify(body, null, 2)
        : '';

    console.log('[CALL] Calling ' + method + ' to ' + url);

    return new Promise((resolve, reject) => {
      const req = http.request(
        url,

        {
          method,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json; charset=utf-8',
          },
        },

        (res) => {
          const chunks = [];

          res.on('data', (chunk) => chunks.push(chunk));

          res.on('end', () => {
            if (res.statusCode !== 200) {
              return reject(new Error('Wrong HTTP code: ' + res.statusCode));
            }

            try {
              resolve(JSON.parse(Buffer.concat(chunks)));
            } catch (err) {
              reject(err);
            }
          });

          res.on('error', reject);
        },
      );

      req.on('error', reject);
      req.end(data);
    });
  }

  pushAudioEvent(zone) {
    this._pushAudioEvents([zone]);
  }

  _sendRoomFavChangedEvents(zones) {
    zones.forEach((zone) => {
      const message = JSON.stringify({
        roomfavchanged_event: [
          {
            playerid: this._zones.indexOf(zone) + 1,
          },
        ],
      });

      this._wsConnections.forEach((connection) => {
        connection.send(message);
      });
    });
  }

  _pushAudioEvents(zones) {
    const audioEvents = zones.map((zone) => {
      return this._getAudioState(zone);
    });

    const message = JSON.stringify({
      audio_event: audioEvents,
    });

    this._wsConnections.forEach((connection) => {
      connection.send(message);
    });
  }

  _handler(method) {
    const index = method.indexOf('?');
    const url = index === -1 ? method : method.substr(0, index);
    const query = querystring.parse(method.substr(url.length + 1));

    switch (true) {
      case /(?:^|\/)audio\/cfg\/all(?:\/|$)/.test(url):
        return this._audioCfgAll(url);

      case /(?:^|\/)audio\/cfg\/equalizer\//.test(url):
        return this._audioCfgEqualizer(url);

      case /(?:^|\/)audio\/cfg\/favorites\/addpath\//.test(url):
        return this._audioCfgFavoritesAddPath(url);

      case /(?:^|\/)audio\/cfg\/getfavorites\//.test(url):
        return this._audioCfgGetFavorites(url);

      case /(?:^|\/)audio\/cfg\/getinputs(?:\/|$)/.test(url):
        return this._emptyCommand(url, []);

      case /(?:^|\/)audio\/cfg\/getmediafolder(?:\/|$)/.test(url):
        return this._audioCfgGetMediaFolder(url, []);

      case /(?:^|\/)audio\/cfg\/get(?:paired)?master(?:\/|$)/.test(url):
        return this._audioCfgGetMaster(url);

      case /(?:^|\/)audio\/cfg\/getplayersdetails(?:\/|$)/.test(url):
        return this._audioCfgGetPlayersDetails(url);

      case /(?:^|\/)audio\/cfg\/getplaylists2\/lms(?:\/|$)/.test(url):
        return this._audioCfgGetPlaylists(url);

      case /(?:^|\/)audio\/cfg\/getradios(?:\/|$)/.test(url):
        return this._emptyCommand(url, []);

      case /(?:^|\/)audio\/cfg\/getroomfavs\//.test(url):
        return this._audioCfgGetRoomFavs(url);

      case /(?:^|\/)audio\/cfg\/getservices(?:\/|$)/.test(url):
        return this._emptyCommand(url, []);

      case /(?:^|\/)audio\/cfg\/getsyncedplayers(?:\/|$)/.test(url):
        return this._audioCfgGetSyncedPlayers(url);

      case /(?:^|\/)audio\/cfg\/iamaminiserver\//.test(url):
        return this._audioCfgIAmAMiniserver(url);

      case /(?:^|\/)audio\/cfg\/mac(?:\/|$)/.test(url):
        return this._audioCfgMac(url);

      case /(?:^|\/)audio\/\d+\/getqueue(?:\/|$)/.test(url):
        return this._audioGetQueue(url, []);

      case /(?:^|\/)audio\/\d+\/library\/play(?:\/|$)/.test(url):
        return this._audioLibraryPlay(url, []);

      case /(?:^|\/)audio\/\d+\/pause(?:\/|$)/.test(url):
        return this._audioPause(url);

      case /(?:^|\/)audio\/\d+\/(?:play|resume)(?:\/|$)/.test(url):
        return this._audioPlay(url);

      case /(?:^|\/)audio\/\d+\/playlist\//.test(url):
        return this._audioPlaylist(url);

      case /(?:^|\/)audio\/\d+\/position\/\d+(?:\/|$)/.test(url):
        return this._audioPosition(url);

      case /(?:^|\/)audio\/\d+\/queueminus(?:\/|$)/.test(url):
        return this._audioQueueMinus(url);

      case /(?:^|\/)audio\/\d+\/queueplus(?:\/|$)/.test(url):
        return this._audioQueuePlus(url);

      case /(?:^|\/)audio\/\d+\/repeat\/\d+(?:\/|$)/.test(url):
        return this._audioRepeat(url);

      case /(?:^|\/)audio\/\d+\/roomfav\/delete\/\d+(\/|$)/.test(url):
        return this._audioRoomFavDelete(url);

      case /(?:^|\/)audio\/\d+\/roomfav\/play\/\d+(?:\/|$)/.test(url):
        return this._audioRoomFavPlay(url);

      case /(?:^|\/)audio\/\d+\/roomfav\/savepath\/\d+\//.test(url):
        return this._audioRoomFavSavePath(url);

      case /(?:^|\/)audio\/\d+\/shuffle\/\d+(?:\/|$)/.test(url):
        return this._audioShuffle(url);

      case /(?:^|\/)audio\/\d+\/volume\/[+-]?\d+(?:\/|$)/.test(url):
        return this._audioVolume(url);

      default:
        return this._unknownCommand(url);
    }
  }

  _audioCfgAll(url) {
    return this._response(url, 'configall', [
      {
        airplay: false,
        dns: '8.8.8.8',
        errortts: false,
        gateway: '0.0.0.0',
        hostname: 'loxberry-music-server-' + this._config.port,
        ip: '0.255.255.255',
        language: 'en',
        lastconfig: '',
        macaddress: this._mac(),
        mask: '255.255.255.255',
        master: true,
        maxplayers: this._config.players,
        ntp: '0.europe.pool.ntp.org',
        upnplicences: 0,
        usetrigger: false,
        players: this._zones.map((zone, i) => ({
          playerid: i + 1,
          clienttype: 0,
          default_volume: zone.getVolume(),
          enabled: true,
          internalname: 'zone-' + (i + 1),
          max_volume: 100,
          name: 'Zone ' + (i + 1),
          upnpmode: 0,
          upnppredelay: 0,
        })),
      },
    ]);
  }

  _audioCfgEqualizer(url) {
    const playerId = +url.split('/').pop();

    return this._response(url, 'equalizer', [
      {
        playerid: playerId,
        equalizer: 'default',
      },
    ]);
  }

  async _audioCfgFavoritesAddPath(url) {
    // ????
  }

  async _audioCfgGetFavorites(url) {
    const [, , , start, length] = url.split('/');
    const {total, items} = await this._favorites.get(+start, +length);

    return this._response(url, 'getfavorites', [
      {
        totalitems: total,
        start: +start,
        items: items.map(this._convert(5, +start)),
      },
    ]);
  }

  async _audioCfgGetMediaFolder(url) {
    const [, , , requestId, start, length] = url.split('/');
    const {total, items} = await this._library.get(+start, +length);

    return this._response(url, 'getmediafolder', [
      {
        id: +requestId,
        totalitems: total,
        start: +start,
        items: items.map(this._convert(2, +start)),
      },
    ]);
  }

  _audioCfgGetMaster(url) {
    return JSON.stringify(url, url.split('/').pop(), null);
  }

  _audioCfgGetPlayersDetails(url) {
    const audioStates = this._zones.map((zone, i) => {
      return this._getAudioState(zone);
    });

    return this._response(url, 'getplayersdetails', audioStates);
  }

  async _audioCfgGetPlaylists(url) {
    const [, , , , , requestId, start, length] = url.split('/');
    const {total, items} = await this._playlists.get(+start, +length);

    return this._response(url, 'getplaylists2', [
      {
        id: +requestId,
        totalitems: total,
        start: +start,
        items: items.map(this._convert(3, +start)),
      },
    ]);
  }

  async _audioCfgGetRoomFavs(url) {
    const [, , , zoneId, start, length] = url.split('/');

    if (+zoneId > 0) {
      const zone = this._zones[+zoneId - 1];
      const {total, items} = await zone.getFavoritesList().get(+start, +length);

      return this._response(url, 'getroomfavs', [
        {
          id: +zoneId,
          totalitems: total,
          start: +start,
          items: items.map(this._convert(4, +start)),
        },
      ]);
    }

    return this._response(url, 'getroomfavs', []);
  }

  _audioCfgGetSyncedPlayers(url) {
    return this._emptyCommand(url, []);
  }

  _audioCfgIAmAMiniserver(url) {
    this._miniserverIp = url.split('/').pop();

    return this._response(url, 'iamamusicserver', {
      iamamusicserver: 'i love miniservers!',
    });
  }

  _audioCfgMac(url) {
    return this._response(url, 'mac', [
      {
        macaddress: this._mac(),
      },
    ]);
  }

  async _audioGetQueue(url) {
    const [, zoneId, , start, length] = url.split('/');
    const zone = this._zones[+zoneId - 1];

    if (+zoneId > 0) {
      const zone = this._zones[+zoneId - 1];
      const {total, items} = await zone.getQueueList().get(+start, +length);

      return this._response(url, 'getqueue', [
        {
          id: +zoneId,
          totalitems: total,
          start: +start,
          items: items.map(this._convert(2, +start)),
        },
      ]);
    }

    return this._response(url, 'getroomfavs', []);
  }

  async _audioLibraryPlay(url) {
    const [, zoneId, , , id] = url.split('/');
    const zone = this._zones[+zoneId - 1];

    zone.play(this._decodeId(id));

    return this._audioCfgGetPlayersDetails('audio/cfg/getplayersdetails');
  }

  async _audioPause(url) {
    const [, zoneId, , volume] = url.split('/');
    const zone = this._zones[+zoneId - 1];

    await zone.pause();

    return this._audioCfgGetPlayersDetails('audio/cfg/getplayersdetails');
  }

  _audioPlay(url) {
    const [, zoneId] = url.split('/');
    const zone = this._zones[+zoneId - 1];

    if (zone.getMode() === 'stop') {
      zone.play('');
    } else {
      zone.resume();
    }

    return this._audioCfgGetPlayersDetails('audio/cfg/getplayersdetails');
  }

  _audioPlaylist(url) {
    const [, zoneId, , , id] = url.split('/');
    const zone = this._zones[+zoneId - 1];

    zone.play(this._decodeId(id));

    return this._audioCfgGetPlayersDetails('audio/cfg/getplayersdetails');
  }

  async _audioPosition(url) {
    const [, zoneId, , time] = url.split('/');
    const zone = this._zones[+zoneId - 1];

    await zone.time(+time * 1000);

    return this._audioCfgGetPlayersDetails('audio/cfg/getplayersdetails');
  }

  _audioQueueMinus(url) {
    const [, zoneId] = url.split('/');
    const zone = this._zones[+zoneId - 1];

    if (zone.getTime() < 3000) {
      zone.previous();
    } else {
      zone.time(0);
    }

    return this._audioCfgGetPlayersDetails('audio/cfg/getplayersdetails');
  }

  _audioQueuePlus(url) {
    const [, zoneId] = url.split('/');
    const zone = this._zones[+zoneId - 1];

    zone.next();

    return this._audioCfgGetPlayersDetails('audio/cfg/getplayersdetails');
  }

  _audioRepeat(url) {
    const [, zoneId, , repeatMode] = url.split('/');
    const zone = this._zones[+zoneId - 1];
    const repeatModes = {0: 0, 1: 2, 3: 1};

    zone.repeat(repeatModes[repeatMode]);

    return this._audioCfgGetPlayersDetails('audio/cfg/getplayersdetails');
  }

  async _audioRoomFavDelete(url) {
    const [, zoneId, , , position, id, title] = url.split('/');
    const zone = this._zones[+zoneId - 1];

    await zone.getFavoritesList().delete(+position - 1, 1);
    this._sendRoomFavChangedEvents([zone]);

    return this._emptyCommand(url, []);
  }

  async _audioRoomFavPlay(url) {
    const [, zoneId, , , position] = url.split('/');
    const zone = this._zones[+zoneId - 1];

    const favorites = await zone.getFavoritesList().get(+position - 1, 1);
    const id = favorites.items[0].id;

    await zone.play(id);

    return this._audioCfgGetPlayersDetails('audio/cfg/getplayersdetails');
  }

  async _audioRoomFavSavePath(url) {
    const [, zoneId, , , position, id, title] = url.split('/');
    const zone = this._zones[+zoneId - 1];
    const decodedId = this._decodeId(id);

    const item = {
      id: decodedId,
      title,
      image: this._imageStore[decodedId],
    };

    await zone.getFavoritesList().replace(+position - 1, item);
    this._sendRoomFavChangedEvents([zone]);

    return this._emptyCommand(url, []);
  }

  _audioShuffle(url) {
    const [, zoneId, , shuffle] = url.split('/');
    const zone = this._zones[+zoneId - 1];

    zone.shuffle(+shuffle);

    return this._audioCfgGetPlayersDetails('audio/cfg/getplayersdetails');
  }

  async _audioVolume(url) {
    const [, zoneId, , volume] = url.split('/');
    const zone = this._zones[+zoneId - 1];

    if (/^[+-]/.test(volume)) {
      await zone.volume(zone.getVolume() + +volume);
    } else {
      await zone.volume(+volume);
    }

    return this._audioCfgGetPlayersDetails('audio/cfg/getplayersdetails');
  }

  _emptyCommand(url, response) {
    const parts = url.split('/');

    for (let i = parts.length; i--; ) {
      if (/^[a-z]/.test(parts[i])) {
        return this._response(url, parts[i], response);
      }
    }
  }

  _unknownCommand(url) {
    console.warn('[HTWS] Unknown command: ' + url);

    return this._emptyCommand(url, null);
  }

  _getAudioState(zone) {
    const repeatModes = {0: 0, 2: 1, 1: 3};

    const track = zone.getTrack();
    const mode = zone.getMode();

    return {
      playerid: this._zones.indexOf(zone) + 1,
      album: track.album,
      artist: track.artist,
      audiotype: 2,
      coverurl: track.image || '',
      duration: mode === 'buffer' ? 0 : Math.ceil(track.duration / 1000),
      mode: mode === 'buffer' ? 'play' : mode,
      plrepeat: repeatModes[zone.getRepeat()],
      plshuffle: zone.getShuffle(),
      power: 'on',
      station: '',
      time: zone.getTime() / 1000,
      title: track.title,
      volume: zone.getVolume(),
    };
  }

  _convert(type, start) {
    return (item, i) => {
      if (!item) {
        return {
          type,
          slot: +start + i + 1,
          isAnEmptySlot: true,
        };
      }

      this._imageStore[item.id] = item.image;

      return {
        type,
        slot: start + i + 1,
        audiopath: this._encodeId(item.id),
        coverurl: item.image || undefined,
        id: this._encodeId(item.id),
        name: item.title,
      };
    };
  }

  _encodeId(data) {
    const table = {
      '+': '-',
      '/': '_',
      '=': '',
    };

    return Buffer.from(data)
      .toString('base64')
      .replace(/[+/=]/g, (str) => table[str]);
  }

  _decodeId(data) {
    const table = {
      '-': '+',
      '_': '/',
    };

    return Buffer.from(
      data.replace(/[-_]/g, (str) => table[str]),
      'base64',
    ).toString();
  }

  _response(url, name, result) {
    const message = {
      [name + '_result']: result,
      command: url,
    };

    return JSON.stringify(message, null, 2);
  }

  _mac() {
    const portAsMacAddress = (this._config.port / 256)
      .toString(16)
      .replace('.', ':')
      .padStart(5, '0');

    return '50:4f:94:ff:' + portAsMacAddress;
  }
};
