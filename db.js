require('dotenv').config();
const Database = require('dbcmps369');
const bcrypt = require('bcryptjs');

class ContactsDB {
    constructor() {
        this.db = new Database();
    }

    async initialize() {
        await this.db.connect();
        await this.db.schema('Contact', [
            { name: 'id', type: 'INTEGER' },
            { name: 'fName', type: 'TEXT' },
            { name: 'lName', type: 'TEXT' },
            { name: 'phone', type: 'INTEGER' },
            { name: 'email', type: 'TEXT' },
            { name: 'contactByEmail', type: 'BOOLEAN' },
            { name: 'contactByPhone', type: 'BOOLEAN' },
            { name: 'contactByMail', type: 'BOOLEAN' },
            { name: 'prefix', type: 'TEXT' },
            { name: 'address', type: 'TEXT' },
            { name: 'lat', type: 'NUMERIC' },
            { name: 'lng', type: 'NUMERIC' }
        ], 'id');
        await this.db.schema('User', [
            { name: 'id', type: 'INTEGER' },
            { name: 'fName', type: 'TEXT' },
            { name: 'lName', type: 'TEXT' },
            { name: 'userName', type: 'TEXT' },
            { name: 'password', type: 'TEXT' },
        ], 'id');

        // Create the default user
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash('cmps369', salt);
        await this.db.create('User', [
            { column: 'fName', value: '' },
            { column: 'lName', value: '' },
            { column: 'userName', value: 'rcnj' },
            { column: 'password', value: passwordHash }
        ]);
    }

    async getContacts() {
        const contacts = await this.db.read('Contact', []);
        return contacts;
    }

    async createContact(fName, lName, phone, email, contactByEmail, contactByPhone, contactByMail, prefix, address, lat, lng) {
        const id = await this.db.create('Contact', [
            { column: 'fName', value: fName },
            { column: 'lName', value: lName },
            { column: 'phone', value: phone },
            { column: 'email', value: email },
            { column: 'contactByEmail', value: contactByEmail },
            { column: 'contactByPhone', value: contactByPhone },
            { column: 'contactByMail', value: contactByMail },
            { column: 'prefix', value: prefix },
            { column: 'address', value: address },
            { column: 'lat', value: lat },
            { column: 'lng', value: lng }
        ]);
        return id;
    }

    async createUser(fName, lName, userName, password) {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        const id = await this.db.create('User', [
            { column: 'fName', value: fName },
            { column: 'lName', value: lName },
            { column: 'userName', value: userName },
            { column: 'password', value: passwordHash },
        ]);
        return id;
    }

    async checkPassword(id, inputPassword) {
        const user = await this.db.read('User', [{ column: 'id', value: id }]);
        if (user.length > 0) {
            const passwordMatch = await bcrypt.compare(inputPassword, user[0].password);
            return passwordMatch;
        }
        return false;
    }

    async deleteContact(id) {
        await this.db.delete('Contact', [{ column: 'id', value: id }]);
    }

    async getIDByUsername(username) {
        const user = await this.db.read('User', [{ column: 'userName', value: username }]);
        if (user.length > 0) {
            return user[0].id;  // Assuming user is found, return the first user's id.
        }
        throw new Error('User not found');
    }

    async getUserByID(id) {
        const user = await this.db.read('User', [{ column: 'id', value: id }]);
        if (user.length > 0) {
            return {
                id: user[0].id,
                fName: user[0].fName,
                lName: user[0].lName,
                userName: user[0].userName,
                password: user[0].password // You typically won't need to return the password, consider omitting it for security
            };
        }
        throw new Error('User not found');
    }

    async getContactById(id) {
        const contacts = await this.db.read('Contact', [{ column: 'id', value: id }]);
        if (contacts.length > 0) {
            return contacts[0]; // Returns the first (and should be only) contact with the given ID
        }
        return null; // Return null if no contact found
    }

    async updateContact(id, contactDetails) {
        const columnsToUpdate = [
            { column: 'fName', value: contactDetails.fName },
            { column: 'lName', value: contactDetails.lName },
            { column: 'phone', value: contactDetails.phone },
            { column: 'email', value: contactDetails.email },
            { column: 'contactByEmail', value: contactDetails.contactByEmail },
            { column: 'contactByPhone', value: contactDetails.contactByPhone },
            { column: 'contactByMail', value: contactDetails.contactByMail },
            { column: 'prefix', value: contactDetails.prefix },
            { column: 'address', value: contactDetails.formattedAddress },
            { column: 'lat', value: contactDetails.lat },
            { column: 'lng', value: contactDetails.lng }
        ];
        await this.db.update('Contact', columnsToUpdate, [{ column: 'id', value: id }]);
    }

    async usernameExists(username) {
        const result = await this.db.read('User', [{ column: 'userName', value: username }]);
        return result.length > 0;  // Returns true if username exists, false otherwise
    }


}

module.exports = ContactsDB;