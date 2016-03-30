# Scientist.NET Demo App

Demonstrates a simple usage of [Scientist.NET](https://github.com/Haacked/Scientist.net).

See the PermissionsController for the main Scientist.NET code. It refactors some simple PermissionService method calls.

## Setup

It depends on the below database schema. From Visual Studio, connect to your `(localdb)\MSSQLLocalDb` SQL server
instance, and create the following tables in your ApplicationDbContext database. The database should be created 
automatically for you when you run the application.

```sql
CREATE TABLE [dbo].[Users] (
    [Id]       UNIQUEIDENTIFIER NOT NULL,
    [Username] NVARCHAR (MAX)   NULL,
    CONSTRAINT [PK_dbo.Users] PRIMARY KEY CLUSTERED ([Id] ASC)
);

CREATE TABLE [dbo].[Roles] (
    [Id]       UNIQUEIDENTIFIER NOT NULL,
    [RoleName] VARCHAR (800)    NOT NULL,
    PRIMARY KEY CLUSTERED ([Id] ASC)
);

CREATE TABLE [dbo].[UserRoles] (
    [UserId] UNIQUEIDENTIFIER NOT NULL,
    [RoleId] UNIQUEIDENTIFIER NOT NULL,
    CONSTRAINT [FK_UserRoles_Roles] FOREIGN KEY ([RoleId]) REFERENCES [dbo].[Roles] ([Id]),
    CONSTRAINT [FK_UserRoles_Users] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users] ([Id])
);
```

If you want to run the demo IResultPublisher (which reports to InfluxDB), you'll need to provide the InfluxDB connection details in the web.config.

This project includes a compiled version of lib/Scientist.dll. This is because the version on NuGet is old (as of March 2016).
