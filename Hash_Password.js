// hash_password.js

import bcrypt from 'bcryptjs';

const password = 'admin123';
const saltRounds = 10; // Use the same salt rounds as your application (10 is standard)

async function hashPassword() {
    try {
        const salt = await bcrypt.genSalt(saltRounds);
        const hash = await bcrypt.hash(password, salt);
        
        console.log(`Original Password: ${password}`);
        console.log(`Generated Hash: ${hash}`);
        console.log(`\nCopy the Generated Hash above and use it for your admin user in MongoDB.`);
    } catch (error) {
        console.error("Hashing failed:", error);
    }
}

hashPassword();