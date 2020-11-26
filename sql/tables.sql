drop table if exists pins;
drop table if exists states;
drop table if exists users;

-- To make a new database in sql we do:
-- CREATE DATABASE database_name;

-- To insert into the database
-- mysql -u user -p dbName < sql/tables.sql

create table users (
  user_id      integer primary key AUTO_INCREMENT,
  first_name   varchar(20),
  last_name    varchar(20),
  username     varchar(30) unique,
  password     varchar(60),
  is_admin     boolean
);

create table states (
  state_ab               varchar(2) primary key,
  covid_count            integer,
  covid_death            integer,
  trajectory_death       integer,
  trajectory_hospitalize integer,
  trajectory_test        integer,
  state_name             varchar(25)
);

create table pins (
  pin_id      integer primary key AUTO_INCREMENT,
  user        integer,
  state_name  varchar(25),
  city        varchar(30),
  is_public   boolean,
  foreign key (user) references users(user_id)
);

