using System;
using System.Collections.Generic;
using System.Data.Entity;
using System.Linq;
using System.Web;

namespace MyTestWebApp.Models
{
    public class ApplicationDbContext : DbContext
    {
        // You can add custom code to this file. Changes will not be overwritten.
        // 
        // If you want Entity Framework to drop and regenerate your database
        // automatically whenever you change your model schema, please use data migrations.
        // For more information refer to the documentation:
        // http://msdn.microsoft.com/en-us/data/jj591621.aspx

        public ApplicationDbContext() : base("name=ApplicationDbContext")
        {
        }
        static ApplicationDbContext()
        {
            AppDomain.CurrentDomain.SetData("DataDirectory", System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Databases"));
        }

        public DbSet<User> Users { get; set; }
        public DbSet<Role> Roles { get; set; }

        public DbSet<UserRole> UserRoles { get; set; }

        protected override void OnModelCreating(DbModelBuilder modelBuilder)
        {
            modelBuilder.Entity<User>()
                        .HasMany(u => u.Roles)
                        .WithRequired(u => u.User);
            modelBuilder.Entity<Role>()
                        .HasMany(u => u.Users)
                        .WithRequired(u => u.Role);
            //modelBuilder.Entity<User>()
            //            .HasMany<Role>(s => s.Roles)
            //            .WithMany(c => c.Users)
            //            .Map(cs => {
            //                cs.MapLeftKey("UserId");
            //                cs.MapRightKey("RoleId");
            //                cs.ToTable("UserRoles");
            //            });
        }
    }
}
