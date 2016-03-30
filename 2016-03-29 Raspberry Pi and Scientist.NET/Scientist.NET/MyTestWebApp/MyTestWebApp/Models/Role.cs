using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Web;

namespace MyTestWebApp.Models
{
    public class Role
    {
        [Key]
        public Guid Id { get; set; }
        public string RoleName { get; set; }
        public virtual ICollection<UserRole> Users { get; set; }
    }
}