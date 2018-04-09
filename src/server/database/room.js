const { ObjectId } = require('mongodb');
const { insertOrUpdateEntity, pageableCollection } = require('./helpers');
const { getUser } = require('./user');

const TABLE = 'rooms';

/**
 * @typedef {{
 *  [_id]: string,
 *  name: string,
 *  users: string[]
 * }} Room
 */

/**
 * @param {Db} db
 * @param {string} id
 *
 * @return {Promise<Room>}
 */
async function getRoom(db, id) {
  return db.collection(TABLE).findOne({ _id: ObjectId(id.toString()) });
}

/**
 * @param {Db} db
 * @param {Room} room
 *
 * @return {Promise<Room>}
 */
async function saveRoom(db, room) {
  return insertOrUpdateEntity(db.collection(TABLE), room);
}

/**
 * @param {Db} db
 * @param {{}} filter
 *
 * @return {Promise<Pagination<Room>>}
 */
async function getRooms(db, filter) {
  return pageableCollection(db.collection(TABLE), filter);
}

/**
 * @param {Db} db
 * @param {string} userId
 * @param {{}} [filter]
 *
 * @return {Promise<Pagination<Room>>}
 */
async function getUserRooms(db, userId, filter) {
  return pageableCollection(db.collection(TABLE), {
    users: userId.toString(),
    ...filter,
  });
}

/**
 * @param {Db} db
 * @param {User} currentUser
 * @param {Room} room
 *
 * @return {Promise<Room>}
 */
async function createRoom(db, currentUser, room) {
  if (!room.name) {
    throw new Error('Cannot create room without name');
  }

  const collection = db.collection(TABLE),
    existsRoom = await collection.findOne({ name: room.name });

  if (!existsRoom) {
    // If we clone room
    // eslint-disable-next-line no-param-reassign
    delete room._id;

    // eslint-disable-next-line no-param-reassign
    room.users = room.users || [];
    room.users.push(currentUser._id.toString());

    return insertOrUpdateEntity(collection, room);
  }

  return {
    error: 'Room with same name already exists',
    code: 409,
  };
}

/**
 *
 * @param {Db} db
 * @param {string} roomId
 * @param {string} userId
 *
 * @return {Promise<Room>}
 */
async function joinRoom(db, { roomId, userId }) {
  if (!roomId) {
    throw new Error('You must specify roomId to join');
  }

  if (!userId) {
    throw new Error('You must specify userId to join');
  }

  const collection = db.collection(TABLE),
    [room, user] = await Promise.all([getRoom(db, roomId), getUser(db, userId)]);

  if (!room) {
    throw new Error(`Cannot find room with id=${roomId}`);
  }

  if (!user) {
    throw new Error(`Unknown user with id=${userId}`);
  }
  const users = room.users.map(oneUser => oneUser.toString());

  if (users.indexOf(userId.toString()) > -1) {
    return room;
  }

  users.push(userId.toString());

  // Make array unique
  room.users = [...new Set(users)].map(oneUserId => ObjectId(oneUserId));

  // Save users to database
  await collection.updateOne({ _id: room._id }, { $set: { users: room.users } });

  return room;
}

/**
 * @param {Db} db
 * @param {string} roomId
 * @param {string} userId
 *
 * @return {Promise<Room>}
 */
async function leaveRoom(db, { roomId, userId }) {
  if (!roomId) {
    throw new Error('You must specify roomId to join');
  }

  if (!userId) {
    throw new Error('You must specify userId to join');
  }

  const collection = db.collection(TABLE),
    [room, user] = await Promise.all([getRoom(db, roomId), getUser(db, userId)]);

  if (!room) {
    throw new Error(`Cannot find room with id=${roomId}`);
  }

  if (!user) {
    throw new Error(`Unknown user with id=${userId}`);
  }

  room.users = room.users
    .filter(oneUser => oneUser.toString() !== userId.toString());

  // Save users to database
  await collection.updateOne({ _id: room._id }, { $set: { users: room.users } });

  return room;
}

module.exports = {
  saveRoom,
  getRooms,
  getUserRooms,
  createRoom,
  getRoom,
  joinRoom,
  leaveRoom,
};
