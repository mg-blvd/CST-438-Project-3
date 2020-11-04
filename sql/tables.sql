drop table if exists pins;
drop table if exists states;
drop table if exists users;

-- To mae a new database in sql we do:
-- CREATE DATABASE database_name;



create table users (
  user_id      integer primary key AUTO_INCREMENT,
  first_name   varchar(20),
  last_name    varchar(20),
  username     varchar(30) unique,
  password     varchar(60),
  is_admin     boolean
);

create table states (
  state       varchar(2) primary key,
  covid_count integer
);

create table pins (
  pin_id      integer primary key AUTO_INCREMENT,
  user        integer,
  cases       integer,    -- can't get the the cases from the states table
  state       varchar(2);
  location    varchar(30),
  description varchar(200),
  air_quality varchar(100),
  is_public   boolean,   -- here should it come from the user?
  foreign key (user) references users(user_id),
  foreign key (state) references states(state)
);

