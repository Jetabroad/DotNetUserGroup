using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Web;

namespace MyTestWebApp.Models
{
    [Table("UserRoles")]
    public class UserRole
    {
        [Key, Column(Order = 0)]
        public Guid UserId { get; set; }
        public virtual User User { get; set; }
        [Key, Column(Order = 1)]
        public Guid RoleId { get; set; }
        public virtual Role Role { get; set; }
    }
}