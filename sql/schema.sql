-- MigsList Database Schema
-- Union Member Management System

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Unions table
CREATE TABLE unions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255),
    contact_name VARCHAR(255),
    contact_phone VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'expired', 'cancelled')),
    payment_status VARCHAR(50) DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'expired')),
    subscription_start DATE,
    subscription_end DATE,
    payment_reference VARCHAR(255),
    payment_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Signup requests table (before union is created)
CREATE TABLE signup_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    union_name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(50),
    admin_email VARCHAR(255) NOT NULL,
    admin_first_name VARCHAR(100),
    admin_last_name VARCHAR(100),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Users table (Super Admins & Union Admins)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) NOT NULL CHECK (role IN ('super_admin', 'union_admin')),
    union_id UUID REFERENCES unions(id) ON DELETE SET NULL,
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Buckets table
CREATE TABLE buckets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    union_id UUID NOT NULL REFERENCES unions(id) ON DELETE CASCADE,
    number VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(union_id, number)
);

-- Members table
CREATE TABLE members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bucket_id UUID NOT NULL REFERENCES buckets(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    zip VARCHAR(20),
    pdf_filename VARCHAR(255),
    pdf_uploaded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Session table for connect-pg-simple
CREATE TABLE "session" (
    "sid" VARCHAR NOT NULL COLLATE "default",
    "sess" JSON NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL,
    PRIMARY KEY ("sid")
);

CREATE INDEX "IDX_session_expire" ON "session" ("expire");

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_union_id ON users(union_id);
CREATE INDEX idx_buckets_union_id ON buckets(union_id);
CREATE INDEX idx_members_bucket_id ON members(bucket_id);
CREATE INDEX idx_members_good_standing ON members(bucket_id) WHERE pdf_filename IS NOT NULL;
CREATE INDEX idx_unions_status ON unions(status);
CREATE INDEX idx_signup_requests_status ON signup_requests(status);

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to users table
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to members table
CREATE TRIGGER update_members_updated_at
    BEFORE UPDATE ON members
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
