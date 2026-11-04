
import bcrypt from 'bcrypt';
import postgres from 'postgres';
import { invoices, customers, revenue, users } from '../lib/placeholder-data';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

async function seedUsers(db: postgres.TransactionSql) {
  await db`
    CREATE TABLE IF NOT EXISTS users (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    );
  `;

  for (const user of users) {
    const hashedPassword = await bcrypt.hash(user.password, 10);

    await db`
      INSERT INTO users (id, name, email, password)
      VALUES (${user.id}, ${user.name}, ${user.email}, ${hashedPassword})
      ON CONFLICT (id) DO NOTHING;
    `;
  }
}

async function seedCustomers(db: postgres.TransactionSql) {
  await db`
    CREATE TABLE IF NOT EXISTS customers (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      image_url VARCHAR(255) NOT NULL
    );
  `;

  for (const customer of customers) {
    await db`
      INSERT INTO customers (id, name, email, image_url)
      VALUES (${customer.id}, ${customer.name}, ${customer.email}, ${customer.image_url})
      ON CONFLICT (id) DO NOTHING;
    `;
  }
}


async function seedInvoices(db: postgres.TransactionSql) {
  await db`
    CREATE TABLE IF NOT EXISTS invoices (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      customer_id UUID NOT NULL,
      amount INT NOT NULL,
      status VARCHAR(255) NOT NULL,
      date DATE NOT NULL
    );
  `;

  await db`ALTER TABLE invoices
    ADD CONSTRAINT unique_invoice
    UNIQUE (customer_id, amount, status, date);
    `;
  
  for (const [index, invoice] of invoices.entries()) {
    // Generate a consistent UUID based on the invoice's position
    const invoiceId = crypto.randomUUID();

    await db`
      INSERT INTO invoices (customer_id, amount, status, date)
      VALUES (${invoice.customer_id}, ${invoice.amount}, ${invoice.status}, ${invoice.date})
      ON CONFLICT (customer_id, amount, status, date) DO NOTHING;
    `;
  }
}


async function seedRevenue(db: postgres.TransactionSql) {
  await db`
    CREATE TABLE IF NOT EXISTS revenue (
      month VARCHAR(4) NOT NULL UNIQUE,
      revenue INT NOT NULL
    );
  `;

  for (const rev of revenue) {
    await db`
      INSERT INTO revenue (month, revenue)
      VALUES (${rev.month}, ${rev.revenue})
      ON CONFLICT (month) DO NOTHING;
    `;
  }
}

export async function GET() {
  try {
    await sql.begin(async (tx) => {
      console.log('Creating UUID extension...');
      await tx`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;

      console.log('Seeding users...');
      await seedUsers(tx);

      console.log('Seeding customers...');
      await seedCustomers(tx);

      console.log('Seeding invoices...');
      await seedInvoices(tx);

      console.log('Seeding revenue...');
      await seedRevenue(tx);

      console.log('Seeding complete!');
    });

    return Response.json({
      message: 'Database seeded successfully',
    });
  } catch (error) {
    console.error('Database seeding failed:', error);

    return Response.json(
      { error: 'Database seeding failed' },
      { status: 500 },
    );
  }
}
