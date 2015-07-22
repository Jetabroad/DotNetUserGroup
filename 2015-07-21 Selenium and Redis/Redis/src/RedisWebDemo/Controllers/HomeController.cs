using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using RedisWebDemo.Models;

namespace RedisWebDemo.Controllers
{
    public class HomeController : Controller
    {
        public ActionResult Index()
        {
            var user = Session["current_user"];

            if (user == null)
                return RedirectToAction("Login");

            return View(user);
        }
        public ActionResult Login()
        {
            return View();
        }
        [HttpPost]
        public ActionResult Login(User login)
        {
            Session["current_user"] = users[login.Id];

            return RedirectToAction("Index");
        }

        private static IDictionary<string, User> users = new[]
        {
            new User { Id = "adison.prakongpan@bkk.jetabroad.com", Name = "Adison Prakongpan" },
            new User { Id = "adison.prakongpan@gmail.com", Name = "Ace Adison" }
        }
        .ToDictionary(x => x.Id); 
    }
}
