using MyTestWebApp.Models;
using System;
using System.Collections.Generic;
using System.Data.Entity.Core.Objects;
using System.Linq;
using System.Web;

namespace MyTestWebApp
{
    public static class PermissionService
    {
        /// <summary>
        /// Get a matrix of users and their supported roles
        /// </summary>
        public static IEnumerable<Permission> GetApplicationPermissionsV1(this ApplicationDbContext db)
        {
            var users = db.Users.ToList();
            var roles = db.Roles.ToList();

            foreach (var user in users)
            {
                foreach (var role in roles)
                {
                    if(user.Roles.Select(r => r.Role).Contains(role))
                    {
                        yield return new Permission
                        {
                            UserName = user.Username,
                            RoleName = role.RoleName
                        };
                    }
                }
            }
        }

        public static IEnumerable<Permission> GetApplicationPermissionsV2(this ApplicationDbContext db)
        {
            var query = from user in db.Users
                   from role in db.Roles
                   select new Permission
                   {
                       UserName = user.Username,
                       RoleName = role.RoleName
                   };
            return query.ToList();
        }

        public static IEnumerable<Permission> GetApplicationPermissionsV3(this ApplicationDbContext db)
        {
            var query = from user in db.Users
                   join userrole in db.UserRoles on user.Id equals userrole.UserId
                   join role in db.Roles on userrole.RoleId equals role.Id
                   select new Permission
                   {
                       UserName = user.Username,
                       RoleName = role.RoleName
                   };
            return query.ToList();
        }

    }
}