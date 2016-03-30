using System;
using System.Collections.Generic;
using System.Data;
using System.Data.Entity;
using System.Linq;
using System.Net;
using System.Web;
using System.Web.Mvc;
using MyTestWebApp.Models;
using GitHub;

namespace MyTestWebApp.Controllers
{
    public class PermissionsController : Controller
    {
        readonly ApplicationDbContext db = new ApplicationDbContext();

        public ActionResult Index()
        {
            var permissions = Scientist.Science<IEnumerable<Permission>>("Permissions", experiment =>
            {
                experiment.Compare((x, y) => x.SequenceEqual(y));
                experiment.Use(() => db.GetApplicationPermissionsV1().ToList());
                experiment.Try(() => db.GetApplicationPermissionsV3().ToList());
            });
            return View(permissions);
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                db.Dispose();
            }
            base.Dispose(disposing);
        }
    }
}
